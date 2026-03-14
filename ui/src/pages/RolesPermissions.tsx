import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import PermissionMatrix from '@/components/admin/PermissionMatrix';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import {
  Shield, Plus, Edit, Trash2, Search, Loader2, X, ChevronLeft, Lock, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };

interface RoleData {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  color: string;
  is_system: boolean;
  is_active: boolean;
  permissions: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export default function RolesPermissions() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [schema, setSchema] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#1B8EE5');
  const [formPermissions, setFormPermissions] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesData, schemaData] = await Promise.all([
        apiClient.listRoles(),
        apiClient.getPermissionSchema(),
      ]);
      setRoles(rolesData);
      setSchema(schemaData);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingRole(null);
    setIsCreating(true);
    setFormName('');
    setFormDisplayName('');
    setFormDescription('');
    setFormColor('#1B8EE5');
    // Initialize all permissions to false
    const perms: Record<string, boolean> = {};
    Object.entries(schema).forEach(([mod, actions]) => {
      actions.forEach(a => { perms[`${mod}.${a}`] = false; });
    });
    setFormPermissions(perms);
  };

  const openEdit = (role: RoleData) => {
    setIsCreating(false);
    setEditingRole(role);
    setFormName(role.name);
    setFormDisplayName(role.display_name);
    setFormDescription(role.description || '');
    setFormColor(role.color || '#1B8EE5');
    setFormPermissions({ ...role.permissions });
  };

  const closePanel = () => {
    setEditingRole(null);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formDisplayName.trim()) {
      toast({ title: 'Validation', description: 'Name and display name are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (isCreating) {
        await apiClient.createRole({
          name: formName.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: formDisplayName.trim(),
          description: formDescription.trim() || null,
          color: formColor,
          permissions: formPermissions,
        });
        toast({ title: 'Role created', description: `${formDisplayName} has been created.` });
      } else if (editingRole) {
        await apiClient.updateRole(editingRole.id, {
          display_name: formDisplayName.trim(),
          description: formDescription.trim() || null,
          color: formColor,
          permissions: formPermissions,
        });
        toast({ title: 'Role updated', description: `${formDisplayName} has been updated.` });
      }
      closePanel();
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: RoleData) => {
    if (role.is_system) {
      toast({ title: 'Cannot delete', description: 'System roles cannot be deleted.', variant: 'destructive' });
      return;
    }
    if (!confirm(`Delete role "${role.display_name}"? This cannot be undone.`)) return;
    try {
      await apiClient.deleteRole(role.id);
      toast({ title: 'Deleted', description: `${role.display_name} has been removed.` });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const filteredRoles = roles.filter(r =>
    r.display_name.toLowerCase().includes(search.toLowerCase()) ||
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const permCount = (perms: Record<string, boolean>) =>
    Object.values(perms).filter(Boolean).length;

  const totalPerms = Object.values(schema).reduce((sum, a) => sum + a.length, 0);

  const showPanel = isCreating || editingRole;

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Main content */}
        <div className={`flex-1 p-6 transition-all ${showPanel ? 'pr-[440px]' : ''}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="h-6 w-6 text-[#1B8EE5]" />
                Roles & Permissions
              </h1>
              <p className="text-sm text-slate-400 mt-1">Manage user roles and their access permissions</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            >
              <Plus className="h-4 w-4" /> Create Role
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search roles..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
              style={glassInput}
            />
          </div>

          {/* Roles table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#1B8EE5]" />
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={glassCard}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Description</th>
                    <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Permissions</th>
                    <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Type</th>
                    <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map((role) => (
                    <tr key={role.id} className="hover:bg-white/5 transition-colors" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${role.color}20` }}>
                            <Shield className="h-4 w-4" style={{ color: role.color }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{role.display_name}</p>
                            <p className="text-xs text-slate-500">{role.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-400 max-w-xs truncate">{role.description || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-white">{permCount(role.permissions)}</span>
                        <span className="text-xs text-slate-500">/{totalPerms}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {role.is_system ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                            <Lock className="h-3 w-3" /> System
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#1B8EE5]/20 text-[#1B8EE5]">
                            Custom
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(role)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                            <Edit className="h-4 w-4" />
                          </button>
                          {!role.is_system && (
                            <button onClick={() => handleDelete(role)} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRoles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                        No roles found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Side panel */}
        <AnimatePresence>
          {showPanel && (
            <motion.div
              initial={{ x: 440, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 440, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-screen w-[440px] z-40 overflow-y-auto"
              style={{ background: 'var(--orbis-page)', borderLeft: '1px solid var(--orbis-border)' }}
            >
              <div className="p-6">
                {/* Panel header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <ChevronLeft className="h-5 w-5 text-slate-400 cursor-pointer hover:text-white" onClick={closePanel} />
                    {isCreating ? 'Create New Role' : `Edit: ${editingRole?.display_name}`}
                  </h2>
                  <button onClick={closePanel} className="p-2 rounded-lg hover:bg-white/10 text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Form fields */}
                <div className="space-y-4 mb-6">
                  {isCreating && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Slug (internal name)</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="e.g. senior_recruiter"
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={glassInput}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Display Name</label>
                    <input
                      type="text"
                      value={formDisplayName}
                      onChange={e => setFormDisplayName(e.target.value)}
                      placeholder="e.g. Senior Recruiter"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={glassInput}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                    <textarea
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      placeholder="Describe what this role can do..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                      style={glassInput}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Badge Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formColor}
                        onChange={e => setFormColor(e.target.value)}
                        className="h-9 w-12 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={formColor}
                        onChange={e => setFormColor(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm"
                        style={glassInput}
                      />
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#1B8EE5]" />
                    Permissions
                    <span className="text-xs text-slate-500">
                      ({Object.values(formPermissions).filter(Boolean).length}/{totalPerms} enabled)
                    </span>
                  </h3>
                  <PermissionMatrix
                    permissions={formPermissions}
                    schema={schema}
                    onChange={setFormPermissions}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 sticky bottom-0 py-4" style={{ background: 'var(--orbis-page)' }}>
                  <button
                    onClick={closePanel}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    style={{ border: '1px solid var(--orbis-border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isCreating ? 'Create Role' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
