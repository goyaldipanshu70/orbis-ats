import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, Mail, Lock, User, Shield } from 'lucide-react';
import { apiClient } from '@/utils/api';

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
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

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateUserModal = ({ isOpen, onClose, onSuccess }: CreateUserModalProps) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'hr' as 'admin' | 'hr' | 'hiring_manager' | 'interviewer' | 'candidate',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiClient.createAdminUser(formData);
      toast({
        title: 'Success',
        description: 'User created successfully.',
      });
      onSuccess();
      onClose();
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        role: 'hr',
      });
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to create user. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
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
                <UserPlus className="h-4.5 w-4.5" />
              </div>
              Create New User
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Add a new user to the system with the specified role and permissions.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="first_name" className="text-sm flex items-center gap-1.5 text-slate-300">
                <User className="h-3.5 w-3.5 text-slate-500" /> First Name
              </label>
              <input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
                className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500"
                style={glassInput}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="last_name" className="text-sm text-slate-300">Last Name</label>
              <input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
                className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500"
                style={glassInput}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm flex items-center gap-1.5 text-slate-300">
              <Mail className="h-3.5 w-3.5 text-slate-500" /> Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              required
              className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500"
              style={glassInput}
              placeholder="john.doe@company.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm flex items-center gap-1.5 text-slate-300">
              <Lock className="h-3.5 w-3.5 text-slate-500" /> Password
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              required
              minLength={8}
              className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-all placeholder:text-slate-500"
              style={glassInput}
              placeholder="Min. 8 characters"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="role" className="text-sm flex items-center gap-1.5 text-slate-300">
              <Shield className="h-3.5 w-3.5 text-slate-500" /> Role
            </label>
            <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
              <SelectTrigger
                className="rounded-lg border-0 text-white"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' }}>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                <SelectItem value="interviewer">Interviewer</SelectItem>
                <SelectItem value="candidate">Candidate</SelectItem>
              </SelectContent>
            </Select>
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                </span>
              ) : (
                'Create User'
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserModal;
