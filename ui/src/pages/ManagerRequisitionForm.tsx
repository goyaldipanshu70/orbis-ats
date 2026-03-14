import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import {
  FileText, ChevronLeft, Loader2, Briefcase, DollarSign, AlertTriangle,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };

export default function ManagerRequisitionForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState('full_time');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [headcount, setHeadcount] = useState('1');
  const [justification, setJustification] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: 'Validation', description: 'Position title is required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiClient.createJobRequest({
        title: title.trim(),
        department: department.trim() || undefined,
        description: description.trim() || undefined,
        priority,
        employment_type: employmentType,
        salary_min: salaryMin ? parseInt(salaryMin) : undefined,
        salary_max: salaryMax ? parseInt(salaryMax) : undefined,
        headcount: headcount ? parseInt(headcount) : 1,
        justification: justification.trim() || undefined,
      });
      toast({ title: 'Requisition submitted', description: 'Your request has been sent to HR for review.' });
      navigate('/manager/requisitions');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/manager/requisitions')} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#1B8EE5]" />
            New Requisition
          </h1>
          <p className="text-sm text-slate-400 mt-1">Submit a hiring request to the HR team</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Position Details */}
        <div className="rounded-xl p-5" style={glassCard}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Briefcase className="h-4 w-4 text-[#1B8EE5]" /> Position Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Position Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Software Engineer" className="w-full px-3 py-2.5 rounded-lg text-sm" style={glassInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Department</label>
              <input type="text" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" className="w-full px-3 py-2.5 rounded-lg text-sm" style={glassInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Employment Type</label>
              <Select value={employmentType} onValueChange={setEmploymentType}>
                <SelectTrigger style={glassInput}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' }}>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-xl p-5" style={glassCard}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-[#1B8EE5]" /> Job Description
          </h2>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the role, responsibilities, and ideal candidate profile..."
            rows={6}
            className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
            style={glassInput}
          />
        </div>

        {/* Budget & Priority */}
        <div className="rounded-xl p-5" style={glassCard}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <DollarSign className="h-4 w-4 text-[#1B8EE5]" /> Budget & Priority
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Salary Min</label>
              <input type="number" value={salaryMin} onChange={e => setSalaryMin(e.target.value)} placeholder="e.g. 80000" className="w-full px-3 py-2.5 rounded-lg text-sm" style={glassInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Salary Max</label>
              <input type="number" value={salaryMax} onChange={e => setSalaryMax(e.target.value)} placeholder="e.g. 120000" className="w-full px-3 py-2.5 rounded-lg text-sm" style={glassInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Headcount</label>
              <input type="number" value={headcount} onChange={e => setHeadcount(e.target.value)} min="1" className="w-full px-3 py-2.5 rounded-lg text-sm" style={glassInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger style={glassInput}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' }}>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Justification */}
        <div className="rounded-xl p-5" style={glassCard}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-[#1B8EE5]" /> Justification
          </h2>
          <textarea
            value={justification}
            onChange={e => setJustification(e.target.value)}
            placeholder="Explain why this position is needed, any urgency factors, budget approval status..."
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
            style={glassInput}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <button
            onClick={() => navigate('/manager/requisitions')}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors"
            style={{ border: '1px solid var(--orbis-border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Requisition
          </button>
        </div>
      </div>
    </div>
  );
}
