import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Loader2, Mail, User, Shield, ToggleLeft } from 'lucide-react';
import { apiClient, AdminUser as UserType } from '@/utils/api';

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};
const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};
const selectDrop: React.CSSProperties = {
  background: 'var(--orbis-card)',
  border: '1px solid var(--orbis-border-strong)',
};

const glassInputFocus: React.CSSProperties = {
  background: 'var(--orbis-hover)',
  borderColor: '#1B8EE5',
  boxShadow: '0 0 20px rgba(27,142,229,0.15)',
};

const glassInputBlur: React.CSSProperties = {
  background: 'var(--orbis-input)',
  borderColor: 'var(--orbis-border)',
  boxShadow: 'none',
};

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onSuccess: () => void;
}

const EditUserModal = ({ isOpen, onClose, user, onSuccess }: EditUserModalProps) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'hr' as 'admin' | 'hr' | 'hiring_manager' | 'interviewer' | 'candidate',
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      await apiClient.updateAdminUser(user.id, formData);
      toast({
        title: 'Success',
        description: 'User updated successfully.',
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    Object.assign(e.target.style, glassInputFocus);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    Object.assign(e.target.style, glassInputBlur);
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-0 rounded-2xl p-0" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 rounded-t-2xl" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'rgba(27,142,229,0.05)' }}>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <div
                className="flex items-center justify-center w-9 h-9 rounded-xl text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 15px rgba(27,142,229,0.3)' }}
              >
                <Pencil className="h-4 w-4" />
              </div>
              Edit User
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Update user information and permissions for <span className="font-medium text-white">{user.first_name} {user.last_name}</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit_first_name" className="text-sm flex items-center gap-1.5 text-slate-300">
                <User className="h-3.5 w-3.5 text-slate-500" /> First Name
              </label>
              <input
                id="edit_first_name"
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
                className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500"
                style={glassInput}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit_last_name" className="text-sm text-slate-300">Last Name</label>
              <input
                id="edit_last_name"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
                className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500"
                style={glassInput}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit_email" className="text-sm flex items-center gap-1.5 text-slate-300">
              <Mail className="h-3.5 w-3.5 text-slate-500" /> Email
            </label>
            <input
              id="edit_email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              required
              className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500"
              style={glassInput}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit_role" className="text-sm flex items-center gap-1.5 text-slate-300">
              <Shield className="h-3.5 w-3.5 text-slate-500" /> Role
            </label>
            <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
              <SelectTrigger className="h-11 rounded-xl text-white border-0" style={glassInput}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-0" style={selectDrop}>
                <SelectItem value="admin" className="text-slate-200 focus:bg-white/10 focus:text-white">Administrator</SelectItem>
                <SelectItem value="hr" className="text-slate-200 focus:bg-white/10 focus:text-white">HR</SelectItem>
                <SelectItem value="hiring_manager" className="text-slate-200 focus:bg-white/10 focus:text-white">Hiring Manager</SelectItem>
                <SelectItem value="interviewer" className="text-slate-200 focus:bg-white/10 focus:text-white">Interviewer</SelectItem>
                <SelectItem value="candidate" className="text-slate-200 focus:bg-white/10 focus:text-white">Candidate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
          >
            <div className="space-y-0.5 flex items-start gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                style={{ background: 'var(--orbis-input)' }}
              >
                <ToggleLeft className="h-4 w-4 text-slate-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-white">Account Status</label>
                <p className="text-xs text-slate-500 mt-0.5">Enable or disable user access to the platform</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${formData.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                {formData.is_active ? 'Active' : 'Inactive'}
              </span>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 mt-5" style={{ borderTop: '1px solid var(--orbis-border)' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 15px rgba(27,142,229,0.25)' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Updating...
                </span>
              ) : (
                'Update User'
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserModal;
