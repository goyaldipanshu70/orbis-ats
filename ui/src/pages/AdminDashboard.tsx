import { useState, useEffect, useCallback, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, AdminUser } from '@/utils/api';
import { DataPagination } from '@/components/DataPagination';
import {
  Shield, Users, Activity, Briefcase, UserPlus, Edit, Trash2,
  Search, KeyRound, RotateCcw, FileText, Clock, AlertTriangle, Plus, UserCog, Loader2,
  Mail, Phone, Bot, CheckCircle2, XCircle, Settings2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Design system constants
// ---------------------------------------------------------------------------

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  total_users: number;
  admin_users: number;
  hr_users: number;
  hiring_manager_users: number;
  active_sessions: number;
  total_jobs: number;
  total_candidates: number;
}

interface CreateUserForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: 'admin' | 'hr' | 'hiring_manager';
}

interface EditUserForm {
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'hr' | 'hiring_manager';
  is_active: boolean;
}

interface DocumentTemplate {
  id: number;
  name: string;
  category: string;
  description?: string;
  content: string;
  variables?: string[];
  created_at: string;
  updated_at?: string;
}

interface TemplateForm {
  name: string;
  category: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function userInitials(firstName?: string, lastName?: string): string {
  return `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase();
}

function roleBadgeVariant(role: string) {
  switch (role) {
    case 'admin': return { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' };
    case 'hr': return { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' };
    case 'hiring_manager': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' };
    default: return { bg: 'bg-white/5', text: 'text-slate-400', dot: 'bg-slate-400' };
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'hr':
      return 'HR';
    case 'hiring_manager':
      return 'Hiring Manager';
    default:
      return role;
  }
}

function avatarColor(name: string): string {
  const colors = [
    'bg-blue-600', 'bg-emerald-600', 'bg-blue-600', 'bg-amber-600',
    'bg-rose-600', 'bg-cyan-600', 'bg-blue-600', 'bg-teal-600',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// ---------------------------------------------------------------------------
// ATS Settings Panel
// ---------------------------------------------------------------------------

const ATSSettingsPanel = () => {
  const [settings, setSettings] = useState({
    default_rejection_lock_days: 90,
    rejection_lock_enabled: true,
    otp_email_required: true,
    otp_phone_required: true,
    otp_expiry_minutes: 10,
    otp_max_attempts: 5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    apiClient.getATSSettings()
      .then(data => setSettings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.updateATSSettings(settings);
      toast({ title: 'Saved', description: 'ATS settings updated successfully.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Rejection Lock */}
      <div className="rounded-2xl p-[1px]" style={glassCard}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Rejection Lock Period</h3>
              <p className="text-xs text-slate-400">Block rejected candidates from reapplying.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg p-3" style={{ border: '1px solid var(--orbis-border)' }}>
              <label className="text-sm font-medium text-slate-300">Enable Rejection Lock</label>
              <Switch
                checked={settings.rejection_lock_enabled}
                onCheckedChange={v => setSettings(s => ({ ...s, rejection_lock_enabled: v }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Default Lock Period (days)</label>
              <input
                type="number"
                min={0}
                max={365}
                value={settings.default_rejection_lock_days}
                onChange={e => setSettings(s => ({ ...s, default_rejection_lock_days: Math.max(0, parseInt(e.target.value) || 0) }))}
                className="mt-1.5 w-32 h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                style={glassInput}
                disabled={!settings.rejection_lock_enabled}
              />
              <p className="text-xs text-slate-500 mt-1.5">Individual jobs can override this default.</p>
            </div>
          </div>
        </div>
      </div>

      {/* OTP Verification */}
      <div className="rounded-2xl p-[1px]" style={glassCard}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)' }}>
              <KeyRound className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">OTP Verification</h3>
              <p className="text-xs text-slate-400">Email and phone verification for signup.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg p-3" style={{ border: '1px solid var(--orbis-border)' }}>
              <label className="text-sm font-medium text-slate-300">Require Email Verification</label>
              <Switch
                checked={settings.otp_email_required}
                onCheckedChange={v => setSettings(s => ({ ...s, otp_email_required: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg p-3" style={{ border: '1px solid var(--orbis-border)' }}>
              <label className="text-sm font-medium text-slate-300">Require Phone Verification</label>
              <Switch
                checked={settings.otp_phone_required}
                onCheckedChange={v => setSettings(s => ({ ...s, otp_phone_required: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-300">OTP Expiry (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.otp_expiry_minutes}
                  onChange={e => setSettings(s => ({ ...s, otp_expiry_minutes: Math.max(1, parseInt(e.target.value) || 10) }))}
                  className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  style={glassInput}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">Max Attempts</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.otp_max_attempts}
                  onChange={e => setSettings(s => ({ ...s, otp_max_attempts: Math.max(1, parseInt(e.target.value) || 5) }))}
                  className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  style={glassInput}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="md:col-span-2 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
        >
          {saving ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving...</span> : 'Save ATS Settings'}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Provider Settings Panel (Email / SMS / AI)
// ---------------------------------------------------------------------------

const ProviderSettingsPanel = () => {
  const { toast } = useToast();

  // -- Email
  const [emailSettings, setEmailSettings] = useState({
    provider: 'smtp',
    api_key: '', smtp_host: '', smtp_port: 587, smtp_user: '', smtp_password: '',
    aws_access_key_id: '', aws_secret_access_key: '', aws_region: 'us-east-1', ses_from_email: '',
  });
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');

  // -- SMS
  const [smsSettings, setSmsSettings] = useState({
    provider: 'twilio',
    twilio_account_sid: '', twilio_auth_token: '', twilio_from_number: '',
    vonage_api_key: '', vonage_api_secret: '', vonage_from_number: '',
    aws_access_key_id: '', aws_secret_access_key: '', aws_region: 'us-east-1',
    messagebird_access_key: '', messagebird_originator: '',
  });
  const [smsLoading, setSmsLoading] = useState(true);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsTesting, setSmsTesting] = useState(false);
  const [testSmsTo, setTestSmsTo] = useState('');

  // -- AI
  const [aiSettings, setAiSettings] = useState({
    provider: 'openai',
    openai_api_key: '', openai_model: 'gpt-4o-mini',
    anthropic_api_key: '', anthropic_model: 'claude-sonnet-4-20250514',
    google_api_key: '', google_model: 'gemini-2.0-flash',
  });
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState('');

  useEffect(() => {
    apiClient.getEmailProviderSettings().then(data => { setEmailSettings(s => ({ ...s, ...data })); }).catch(() => {}).finally(() => setEmailLoading(false));
    apiClient.getSMSProviderSettings().then(data => { setSmsSettings(s => ({ ...s, ...data })); }).catch(() => {}).finally(() => setSmsLoading(false));
    apiClient.getAIProviderSettings().then(data => { setAiSettings(s => ({ ...s, ...data })); }).catch(() => {}).finally(() => setAiLoading(false));
  }, []);

  const saveEmail = async () => {
    setEmailSaving(true);
    try {
      await apiClient.updateEmailProviderSettings(emailSettings);
      toast({ title: 'Saved', description: 'Email provider settings updated.' });
    } catch { toast({ title: 'Error', description: 'Failed to save email settings.', variant: 'destructive' }); }
    finally { setEmailSaving(false); }
  };
  const testEmail = async () => {
    if (!testEmailTo) { toast({ title: 'Enter email', description: 'Please enter a test email address.', variant: 'destructive' }); return; }
    setEmailTesting(true);
    try {
      const r = await apiClient.testEmailProvider(testEmailTo);
      toast({ title: 'Success', description: r.message || 'Test email sent.' });
    } catch (e: any) { toast({ title: 'Failed', description: e?.message || 'Test email failed.', variant: 'destructive' }); }
    finally { setEmailTesting(false); }
  };

  const saveSms = async () => {
    setSmsSaving(true);
    try {
      await apiClient.updateSMSProviderSettings(smsSettings);
      toast({ title: 'Saved', description: 'SMS provider settings updated.' });
    } catch { toast({ title: 'Error', description: 'Failed to save SMS settings.', variant: 'destructive' }); }
    finally { setSmsSaving(false); }
  };
  const testSms = async () => {
    if (!testSmsTo) { toast({ title: 'Enter phone', description: 'Please enter a test phone number.', variant: 'destructive' }); return; }
    setSmsTesting(true);
    try {
      const r = await apiClient.testSMSProvider(testSmsTo);
      toast({ title: 'Success', description: r.message || 'Test SMS sent.' });
    } catch (e: any) { toast({ title: 'Failed', description: e?.message || 'Test SMS failed.', variant: 'destructive' }); }
    finally { setSmsTesting(false); }
  };

  const saveAi = async () => {
    setAiSaving(true);
    try {
      await apiClient.updateAIProviderSettings(aiSettings);
      toast({ title: 'Saved', description: 'AI provider settings updated.' });
    } catch { toast({ title: 'Error', description: 'Failed to save AI settings.', variant: 'destructive' }); }
    finally { setAiSaving(false); }
  };
  const testAi = async () => {
    setAiTesting(true);
    setAiTestResult('');
    try {
      const r = await apiClient.testAIProvider();
      setAiTestResult(r.message || 'Connection successful');
      toast({ title: 'Success', description: r.message || 'AI provider test passed.' });
    } catch (e: any) {
      const msg = e?.message || 'AI provider test failed.';
      setAiTestResult(msg);
      toast({ title: 'Failed', description: msg, variant: 'destructive' });
    } finally { setAiTesting(false); }
  };

  if (emailLoading || smsLoading || aiLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* -- Email Provider -- */}
      <div className="rounded-2xl" style={glassCard}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)' }}>
              <Mail className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Email Provider</h3>
              <p className="text-xs text-slate-400">OTP, notifications, and offer letters.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300">Provider</label>
              <Select value={emailSettings.provider} onValueChange={v => setEmailSettings(s => ({ ...s, provider: v }))}>
                <SelectTrigger className="mt-1.5 h-10 text-sm w-52 rounded-xl text-white border-0" style={glassInput}><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>
                  <SelectItem value="sendgrid" className="text-slate-200 focus:bg-white/10 focus:text-white">SendGrid</SelectItem>
                  <SelectItem value="mailgun" className="text-slate-200 focus:bg-white/10 focus:text-white">Mailgun</SelectItem>
                  <SelectItem value="smtp" className="text-slate-200 focus:bg-white/10 focus:text-white">SMTP</SelectItem>
                  <SelectItem value="ses" className="text-slate-200 focus:bg-white/10 focus:text-white">AWS SES</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(emailSettings.provider === 'sendgrid' || emailSettings.provider === 'mailgun') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-300">API Key</label>
                  <input type="password" value={emailSettings.api_key || ''} onChange={e => setEmailSettings(s => ({ ...s, api_key: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="API key" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">{emailSettings.provider === 'mailgun' ? 'Domain' : 'From Email'}</label>
                  <input value={emailSettings.provider === 'mailgun' ? (emailSettings.smtp_host || '') : (emailSettings.smtp_user || '')} onChange={e => setEmailSettings(s => emailSettings.provider === 'mailgun' ? ({ ...s, smtp_host: e.target.value }) : ({ ...s, smtp_user: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder={emailSettings.provider === 'mailgun' ? 'mg.example.com' : 'noreply@example.com'} />
                </div>
              </div>
            )}

            {emailSettings.provider === 'smtp' && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-300">SMTP Host</label><input value={emailSettings.smtp_host || ''} onChange={e => setEmailSettings(s => ({ ...s, smtp_host: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="smtp.gmail.com" /></div>
                <div><label className="text-sm font-medium text-slate-300">SMTP Port</label><input type="number" value={emailSettings.smtp_port || 587} onChange={e => setEmailSettings(s => ({ ...s, smtp_port: parseInt(e.target.value) || 587 }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">Username</label><input value={emailSettings.smtp_user || ''} onChange={e => setEmailSettings(s => ({ ...s, smtp_user: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">Password</label><input type="password" value={emailSettings.smtp_password || ''} onChange={e => setEmailSettings(s => ({ ...s, smtp_password: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
              </div>
            )}

            {emailSettings.provider === 'ses' && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-300">AWS Access Key ID</label><input value={emailSettings.aws_access_key_id || ''} onChange={e => setEmailSettings(s => ({ ...s, aws_access_key_id: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">AWS Secret Access Key</label><input type="password" value={emailSettings.aws_secret_access_key || ''} onChange={e => setEmailSettings(s => ({ ...s, aws_secret_access_key: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">AWS Region</label><input value={emailSettings.aws_region || 'us-east-1'} onChange={e => setEmailSettings(s => ({ ...s, aws_region: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">From Email</label><input value={emailSettings.ses_from_email || ''} onChange={e => setEmailSettings(s => ({ ...s, ses_from_email: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="noreply@example.com" /></div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid var(--orbis-border)' }}>
              <button onClick={saveEmail} disabled={emailSaving} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
                {emailSaving ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</span> : 'Save'}
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <input value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)} className="h-10 px-3 rounded-xl text-sm w-56 outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="test@example.com" />
                <button onClick={testEmail} disabled={emailTesting} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 flex items-center gap-1.5" style={{ ...glassCard }}>
                  {emailTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Test
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* -- SMS Provider -- */}
      <div className="rounded-2xl" style={glassCard}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <Phone className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">SMS Provider</h3>
              <p className="text-xs text-slate-400">OTP verification and notifications.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300">Provider</label>
              <Select value={smsSettings.provider} onValueChange={v => setSmsSettings(s => ({ ...s, provider: v }))}>
                <SelectTrigger className="mt-1.5 h-10 text-sm w-52 rounded-xl text-white border-0" style={glassInput}><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>
                  <SelectItem value="twilio" className="text-slate-200 focus:bg-white/10 focus:text-white">Twilio</SelectItem>
                  <SelectItem value="vonage" className="text-slate-200 focus:bg-white/10 focus:text-white">Vonage</SelectItem>
                  <SelectItem value="sns" className="text-slate-200 focus:bg-white/10 focus:text-white">AWS SNS</SelectItem>
                  <SelectItem value="messagebird" className="text-slate-200 focus:bg-white/10 focus:text-white">MessageBird</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {smsSettings.provider === 'twilio' && (
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-medium text-slate-300">Account SID</label><input value={smsSettings.twilio_account_sid} onChange={e => setSmsSettings(s => ({ ...s, twilio_account_sid: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">Auth Token</label><input type="password" value={smsSettings.twilio_auth_token} onChange={e => setSmsSettings(s => ({ ...s, twilio_auth_token: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">From Number</label><input value={smsSettings.twilio_from_number} onChange={e => setSmsSettings(s => ({ ...s, twilio_from_number: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="+1234567890" /></div>
              </div>
            )}

            {smsSettings.provider === 'vonage' && (
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-medium text-slate-300">API Key</label><input value={smsSettings.vonage_api_key} onChange={e => setSmsSettings(s => ({ ...s, vonage_api_key: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">API Secret</label><input type="password" value={smsSettings.vonage_api_secret} onChange={e => setSmsSettings(s => ({ ...s, vonage_api_secret: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">From Number</label><input value={smsSettings.vonage_from_number} onChange={e => setSmsSettings(s => ({ ...s, vonage_from_number: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="Intesa" /></div>
              </div>
            )}

            {smsSettings.provider === 'sns' && (
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-medium text-slate-300">AWS Access Key ID</label><input value={smsSettings.aws_access_key_id} onChange={e => setSmsSettings(s => ({ ...s, aws_access_key_id: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">AWS Secret Access Key</label><input type="password" value={smsSettings.aws_secret_access_key} onChange={e => setSmsSettings(s => ({ ...s, aws_secret_access_key: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">AWS Region</label><input value={smsSettings.aws_region} onChange={e => setSmsSettings(s => ({ ...s, aws_region: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
              </div>
            )}

            {smsSettings.provider === 'messagebird' && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-300">Access Key</label><input type="password" value={smsSettings.messagebird_access_key} onChange={e => setSmsSettings(s => ({ ...s, messagebird_access_key: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} /></div>
                <div><label className="text-sm font-medium text-slate-300">Originator</label><input value={smsSettings.messagebird_originator} onChange={e => setSmsSettings(s => ({ ...s, messagebird_originator: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="Intesa" /></div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid var(--orbis-border)' }}>
              <button onClick={saveSms} disabled={smsSaving} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
                {smsSaving ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</span> : 'Save'}
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <input value={testSmsTo} onChange={e => setTestSmsTo(e.target.value)} className="h-10 px-3 rounded-xl text-sm w-56 outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="+1234567890" />
                <button onClick={testSms} disabled={smsTesting} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 flex items-center gap-1.5" style={{ ...glassCard }}>
                  {smsTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />} Test
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* -- AI Provider -- */}
      <div className="rounded-2xl" style={glassCard}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgba(27,142,229,0.1)' }}>
              <Bot className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Provider</h3>
              <p className="text-xs text-slate-400">JD analysis, resume scoring, interviews, and RAG.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300">Provider</label>
              <Select value={aiSettings.provider} onValueChange={v => setAiSettings(s => ({ ...s, provider: v }))}>
                <SelectTrigger className="mt-1.5 h-10 text-sm w-52 rounded-xl text-white border-0" style={glassInput}><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>
                  <SelectItem value="openai" className="text-slate-200 focus:bg-white/10 focus:text-white">OpenAI</SelectItem>
                  <SelectItem value="anthropic" className="text-slate-200 focus:bg-white/10 focus:text-white">Anthropic</SelectItem>
                  <SelectItem value="gemini" className="text-slate-200 focus:bg-white/10 focus:text-white">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {aiSettings.provider === 'openai' && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-300">API Key</label><input type="password" value={aiSettings.openai_api_key} onChange={e => setAiSettings(s => ({ ...s, openai_api_key: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="sk-..." /></div>
                <div>
                  <label className="text-sm font-medium text-slate-300">Model</label>
                  <Select value={aiSettings.openai_model} onValueChange={v => setAiSettings(s => ({ ...s, openai_model: v }))}>
                    <SelectTrigger className="mt-1.5 h-10 text-sm rounded-xl text-white border-0" style={glassInput}><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-0" style={selectDrop}>
                      <SelectItem value="gpt-4o-mini" className="text-slate-200 focus:bg-white/10 focus:text-white">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4o" className="text-slate-200 focus:bg-white/10 focus:text-white">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4-turbo" className="text-slate-200 focus:bg-white/10 focus:text-white">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo" className="text-slate-200 focus:bg-white/10 focus:text-white">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {aiSettings.provider === 'anthropic' && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-300">API Key</label><input type="password" value={aiSettings.anthropic_api_key} onChange={e => setAiSettings(s => ({ ...s, anthropic_api_key: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="sk-ant-..." /></div>
                <div>
                  <label className="text-sm font-medium text-slate-300">Model</label>
                  <Select value={aiSettings.anthropic_model} onValueChange={v => setAiSettings(s => ({ ...s, anthropic_model: v }))}>
                    <SelectTrigger className="mt-1.5 h-10 text-sm rounded-xl text-white border-0" style={glassInput}><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-0" style={selectDrop}>
                      <SelectItem value="claude-sonnet-4-20250514" className="text-slate-200 focus:bg-white/10 focus:text-white">Claude Sonnet 4</SelectItem>
                      <SelectItem value="claude-haiku-4-5-20251001" className="text-slate-200 focus:bg-white/10 focus:text-white">Claude Haiku 4.5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {aiSettings.provider === 'gemini' && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-300">API Key</label><input type="password" value={aiSettings.google_api_key} onChange={e => setAiSettings(s => ({ ...s, google_api_key: e.target.value }))} className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" style={glassInput} placeholder="AIza..." /></div>
                <div>
                  <label className="text-sm font-medium text-slate-300">Model</label>
                  <Select value={aiSettings.google_model} onValueChange={v => setAiSettings(s => ({ ...s, google_model: v }))}>
                    <SelectTrigger className="mt-1.5 h-10 text-sm rounded-xl text-white border-0" style={glassInput}><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-0" style={selectDrop}>
                      <SelectItem value="gemini-2.0-flash" className="text-slate-200 focus:bg-white/10 focus:text-white">Gemini 2.0 Flash</SelectItem>
                      <SelectItem value="gemini-2.0-pro" className="text-slate-200 focus:bg-white/10 focus:text-white">Gemini 2.0 Pro</SelectItem>
                      <SelectItem value="gemini-1.5-flash" className="text-slate-200 focus:bg-white/10 focus:text-white">Gemini 1.5 Flash</SelectItem>
                      <SelectItem value="gemini-1.5-pro" className="text-slate-200 focus:bg-white/10 focus:text-white">Gemini 1.5 Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid var(--orbis-border)' }}>
              <button onClick={saveAi} disabled={aiSaving} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
                {aiSaving ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</span> : 'Save'}
              </button>
              <button onClick={testAi} disabled={aiTesting} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 flex items-center gap-1.5" style={{ ...glassCard }}>
                {aiTesting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing...</> : <><Bot className="h-3.5 w-3.5" /> Test Connection</>}
              </button>
              {aiTestResult && (
                <span className={`text-xs font-medium ${aiTestResult.includes('OK') || aiTestResult.includes('successful') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {aiTestResult}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // --- global state ---
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // --- users tab ---
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState({ total: 0, totalPages: 1 });
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>({
    first_name: '', last_name: '', email: '', password: '', role: 'hr',
  });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUserTarget, setEditUserTarget] = useState<AdminUser | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserForm>({
    first_name: '', last_name: '', email: '', role: 'hr', is_active: true,
  });
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUser | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdTarget, setResetPwdTarget] = useState<AdminUser | null>(null);
  const [resetPwdLoading, setResetPwdLoading] = useState(false);
  const [resetPwdNewPassword, setResetPwdNewPassword] = useState('');

  // --- audit logs tab ---
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditActions, setAuditActions] = useState<string[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPagination, setAuditPagination] = useState({ total: 0, totalPages: 1 });

  // --- offer templates tab ---
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesPage, setTemplatesPage] = useState(1);
  const [templatesPagination, setTemplatesPagination] = useState({ total: 0, totalPages: 1 });
  const [templateCategories, setTemplateCategories] = useState<string[]>([]);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [createTemplateForm, setCreateTemplateForm] = useState<TemplateForm>({
    name: '', category: '', content: '',
  });
  const [createTemplateLoading, setCreateTemplateLoading] = useState(false);
  const [editTemplateOpen, setEditTemplateOpen] = useState(false);
  const [editTemplateTarget, setEditTemplateTarget] = useState<DocumentTemplate | null>(null);
  const [editTemplateForm, setEditTemplateForm] = useState<TemplateForm>({
    name: '', category: '', content: '',
  });
  const [editTemplateLoading, setEditTemplateLoading] = useState(false);
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false);
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<DocumentTemplate | null>(null);
  const [deleteTemplateLoading, setDeleteTemplateLoading] = useState(false);

  // -----------------------------------------------------------------------
  // Data loaders
  // -----------------------------------------------------------------------

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await apiClient.getAdminStats();
      setStats(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load dashboard statistics.', variant: 'destructive' });
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const data = await apiClient.getAdminUsers(usersPage, 20);
      setUsers(data.items);
      setUsersPagination({ total: data.total, totalPages: data.total_pages });
    } catch {
      toast({ title: 'Error', description: 'Failed to load users.', variant: 'destructive' });
    } finally {
      setUsersLoading(false);
    }
  }, [usersPage, toast]);

  const loadAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const filter = auditActionFilter === 'all' ? undefined : auditActionFilter;
      const data = await apiClient.getAuditLogs(filter, auditPage, 20);
      setAuditLogs(data.items);
      setAuditTotal(data.total);
      setAuditPagination({ total: data.total, totalPages: data.total_pages });
    } catch {
      // silent -- audit logs are optional
    } finally {
      setAuditLoading(false);
    }
  }, [auditActionFilter, auditPage]);

  const loadAuditActions = useCallback(async () => {
    try {
      const actions = await apiClient.getAuditActions();
      setAuditActions(actions);
    } catch {
      // silent
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const data = await apiClient.getDocumentTemplates(templatesPage, 20);
      setTemplates(data.items);
      setTemplatesPagination({ total: data.total, totalPages: data.total_pages });
    } catch {
      toast({ title: 'Error', description: 'Failed to load templates.', variant: 'destructive' });
    } finally {
      setTemplatesLoading(false);
    }
  }, [templatesPage, toast]);

  const loadTemplateCategories = useCallback(async () => {
    try {
      const cats = await apiClient.getDocumentTemplateCategories();
      setTemplateCategories(cats);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadUsers();
    loadAuditLogs();
    loadAuditActions();
    loadTemplates();
    loadTemplateCategories();
  }, [loadStats, loadUsers, loadAuditLogs, loadAuditActions, loadTemplates, loadTemplateCategories]);

  // -----------------------------------------------------------------------
  // Filtered users
  // -----------------------------------------------------------------------

  const filteredUsers = useMemo(() => {
    let result = users;
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      result = result.filter(
        u =>
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }
    return result;
  }, [users, roleFilter, userSearch]);

  // -----------------------------------------------------------------------
  // User CRUD handlers
  // -----------------------------------------------------------------------

  const handleCreateUser = async () => {
    if (!createUserForm.first_name || !createUserForm.last_name || !createUserForm.email || !createUserForm.password) {
      toast({ title: 'Validation', description: 'All fields are required.', variant: 'destructive' });
      return;
    }
    try {
      setCreateUserLoading(true);
      await apiClient.createAdminUser(createUserForm);
      toast({ title: 'Success', description: 'User created successfully.' });
      setCreateUserOpen(false);
      setCreateUserForm({ first_name: '', last_name: '', email: '', password: '', role: 'hr' });
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create user.', variant: 'destructive' });
    } finally {
      setCreateUserLoading(false);
    }
  };

  const openEditUser = (u: AdminUser) => {
    setEditUserTarget(u);
    setEditUserForm({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      role: u.role as 'admin' | 'hr' | 'hiring_manager',
      is_active: u.is_active,
    });
    setEditUserOpen(true);
  };

  const handleEditUser = async () => {
    if (!editUserTarget) return;
    try {
      setEditUserLoading(true);
      await apiClient.updateAdminUser(editUserTarget.id, editUserForm);
      toast({ title: 'Success', description: 'User updated successfully.' });
      setEditUserOpen(false);
      setEditUserTarget(null);
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update user.', variant: 'destructive' });
    } finally {
      setEditUserLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      setDeleteUserLoading(true);
      await apiClient.deleteAdminUser(deleteUserTarget.id);
      toast({ title: 'Success', description: 'User deleted successfully.' });
      setDeleteUserOpen(false);
      setDeleteUserTarget(null);
      setSelectedUserIds(prev => { const n = new Set(prev); n.delete(deleteUserTarget.id); return n; });
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete user.', variant: 'destructive' });
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdTarget || !resetPwdNewPassword.trim()) return;
    try {
      setResetPwdLoading(true);
      await apiClient.resetAdminUserPassword(resetPwdTarget.id, resetPwdNewPassword);
      toast({ title: 'Success', description: 'Password has been reset. The user will be required to change it on next login.' });
      setResetPwdOpen(false);
      setResetPwdTarget(null);
      setResetPwdNewPassword('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to reset password.', variant: 'destructive' });
    } finally {
      setResetPwdLoading(false);
    }
  };

  const handleToggleUserStatus = async (u: AdminUser) => {
    try {
      await apiClient.updateAdminUserStatus(u.id, !u.is_active);
      setUsers(prev => prev.map(x => (x.id === u.id ? { ...x, is_active: !x.is_active } : x)));
      toast({ title: 'Success', description: `User ${!u.is_active ? 'activated' : 'deactivated'}.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update status.', variant: 'destructive' });
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.size === 0) return;
    try {
      await Promise.all(Array.from(selectedUserIds).map(id => apiClient.deleteAdminUser(id)));
      toast({ title: 'Success', description: `${selectedUserIds.size} user(s) deleted.` });
      setSelectedUserIds(new Set());
      await loadUsers();
      await loadStats();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete users.', variant: 'destructive' });
    }
  };

  // -----------------------------------------------------------------------
  // Template CRUD handlers
  // -----------------------------------------------------------------------

  const handleCreateTemplate = async () => {
    if (!createTemplateForm.name || !createTemplateForm.category || !createTemplateForm.content) {
      toast({ title: 'Validation', description: 'Name, category, and content are required.', variant: 'destructive' });
      return;
    }
    try {
      setCreateTemplateLoading(true);
      await apiClient.createDocumentTemplate({
        name: createTemplateForm.name,
        category: createTemplateForm.category,
        content: createTemplateForm.content,
      });
      toast({ title: 'Success', description: 'Template created successfully.' });
      setCreateTemplateOpen(false);
      setCreateTemplateForm({ name: '', category: '', content: '' });
      await loadTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create template.', variant: 'destructive' });
    } finally {
      setCreateTemplateLoading(false);
    }
  };

  const openEditTemplate = (t: DocumentTemplate) => {
    setEditTemplateTarget(t);
    setEditTemplateForm({
      name: t.name,
      category: t.category,
      content: t.content,
    });
    setEditTemplateOpen(true);
  };

  const handleEditTemplate = async () => {
    if (!editTemplateTarget) return;
    if (!editTemplateForm.name || !editTemplateForm.category || !editTemplateForm.content) {
      toast({ title: 'Validation', description: 'Name, category, and content are required.', variant: 'destructive' });
      return;
    }
    try {
      setEditTemplateLoading(true);
      await apiClient.updateDocumentTemplate(editTemplateTarget.id, {
        name: editTemplateForm.name,
        category: editTemplateForm.category,
        content: editTemplateForm.content,
      });
      toast({ title: 'Success', description: 'Template updated successfully.' });
      setEditTemplateOpen(false);
      setEditTemplateTarget(null);
      await loadTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update template.', variant: 'destructive' });
    } finally {
      setEditTemplateLoading(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateTarget) return;
    try {
      setDeleteTemplateLoading(true);
      await apiClient.deleteDocumentTemplate(deleteTemplateTarget.id);
      toast({ title: 'Success', description: 'Template deleted successfully.' });
      setDeleteTemplateOpen(false);
      setDeleteTemplateTarget(null);
      await loadTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete template.', variant: 'destructive' });
    } finally {
      setDeleteTemplateLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Stats card data
  // -----------------------------------------------------------------------

  const statCards = stats
    ? [
        { label: 'Total Users', value: stats.total_users, icon: Users, gradient: 'linear-gradient(135deg, rgba(59,130,246,0.5), rgba(59,130,246,0.1))', iconBg: 'rgba(59,130,246,0.15)', fg: 'text-blue-400' },
        { label: 'Admin Users', value: stats.admin_users, icon: Shield, gradient: 'linear-gradient(135deg, rgba(27,142,229,0.5), rgba(27,142,229,0.1))', iconBg: 'rgba(27,142,229,0.15)', fg: 'text-blue-400' },
        { label: 'HR Users', value: stats.hr_users, icon: UserCog, gradient: 'linear-gradient(135deg, rgba(16,185,129,0.5), rgba(16,185,129,0.1))', iconBg: 'rgba(16,185,129,0.15)', fg: 'text-emerald-400' },
        { label: 'Active Sessions', value: stats.active_sessions, icon: Activity, gradient: 'linear-gradient(135deg, rgba(245,158,11,0.5), rgba(245,158,11,0.1))', iconBg: 'rgba(245,158,11,0.15)', fg: 'text-amber-400' },
        { label: 'Total Jobs', value: stats.total_jobs, icon: Briefcase, gradient: 'linear-gradient(135deg, rgba(6,182,212,0.5), rgba(6,182,212,0.1))', iconBg: 'rgba(6,182,212,0.15)', fg: 'text-cyan-400' },
        { label: 'Total Candidates', value: stats.total_candidates, icon: Users, gradient: 'linear-gradient(135deg, rgba(244,63,94,0.5), rgba(244,63,94,0.1))', iconBg: 'rgba(244,63,94,0.15)', fg: 'text-rose-400' },
      ]
    : [];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <AppLayout>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">Admin Panel</h1>
        <p className="text-sm text-slate-400 mt-1">
          System administration and configuration
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statsLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl p-4" style={glassCard}>
                <div className="h-9 w-9 rounded-lg bg-white/5 mb-3" />
                <div className="h-7 w-12 bg-white/5 rounded mb-1" />
                <div className="h-4 w-20 bg-white/5 rounded" />
              </div>
            ))
          : statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02]" style={glassCard}>
                  <div className="h-1" style={{ background: card.gradient }} />
                  <div className="p-4">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center mb-3" style={{ background: card.iconBg }}>
                      <Icon className={`h-4.5 w-4.5 ${card.fg}`} />
                    </div>
                    <p className="text-2xl font-bold text-white tracking-tight">
                      {card.value}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">{card.label}</p>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="rounded-xl p-1" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
          <TabsTrigger
            value="users"
            className="rounded-lg text-sm text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 flex items-center gap-2"
          >
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger
            value="audit-logs"
            className="rounded-lg text-sm text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 flex items-center gap-2"
          >
            <Clock className="h-4 w-4" /> Audit Logs
          </TabsTrigger>
          <TabsTrigger
            value="offer-templates"
            className="rounded-lg text-sm text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 flex items-center gap-2"
          >
            <FileText className="h-4 w-4" /> Offer Templates
          </TabsTrigger>
          <TabsTrigger
            value="ats-settings"
            className="rounded-lg text-sm text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 flex items-center gap-2"
          >
            <Shield className="h-4 w-4" /> ATS Settings
          </TabsTrigger>
          <TabsTrigger
            value="providers"
            className="rounded-lg text-sm text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10 flex items-center gap-2"
          >
            <Settings2 className="h-4 w-4" /> Providers
          </TabsTrigger>
        </TabsList>

        {/* ================================================================
            USERS TAB
        ================================================================ */}
        <TabsContent value="users">
          <div className="rounded-2xl" style={glassCard}>
            <div className="p-6">
              {/* Top action bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="pl-9 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                      style={glassInput}
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                    <SelectTrigger className="w-[160px] h-10 text-sm rounded-xl text-white border-0" style={glassInput}>
                      <SelectValue placeholder="Filter role" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-0" style={selectDrop}>
                      <SelectItem value="all" className="text-slate-200 focus:bg-white/10 focus:text-white">All Roles</SelectItem>
                      <SelectItem value="admin" className="text-slate-200 focus:bg-white/10 focus:text-white">Admin</SelectItem>
                      <SelectItem value="hr" className="text-slate-200 focus:bg-white/10 focus:text-white">HR</SelectItem>
                      <SelectItem value="hiring_manager" className="text-slate-200 focus:bg-white/10 focus:text-white">Hiring Manager</SelectItem>
                      <SelectItem value="interviewer" className="text-slate-200 focus:bg-white/10 focus:text-white">Interviewer</SelectItem>
                      <SelectItem value="candidate" className="text-slate-200 focus:bg-white/10 focus:text-white">Candidate</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedUserIds.size > 0 && (
                    <button onClick={handleBulkDelete} className="px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete ({selectedUserIds.size})
                    </button>
                  )}
                </div>
                <button onClick={() => setCreateUserOpen(true)} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
                  <UserPlus className="h-4 w-4" /> Create User
                </button>
              </div>

              {/* Users table */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--orbis-border)' }}>
                <Table>
                  <TableHeader style={{ background: 'var(--orbis-subtle)' }}>
                    <TableRow className="hover:bg-transparent" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <TableHead className="text-slate-500 text-xs font-medium w-12 pl-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                        <Checkbox
                          checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>User</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Email</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Role</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Status</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Last Login</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium text-right pr-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-16">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-500 mx-auto mb-2" />
                          <span className="text-sm text-slate-500">Loading users...</span>
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-16">
                          <Users className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                          <span className="text-sm text-slate-500">No users found.</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u) => {
                        const badge = roleBadgeVariant(u.role);
                        return (
                          <TableRow
                            key={u.id}
                            className="hover:bg-white/[0.02]"
                            style={{ borderBottom: '1px solid var(--orbis-grid)' }}
                          >
                            <TableCell className="text-slate-300 text-sm pl-4">
                              <Checkbox
                                checked={selectedUserIds.has(u.id)}
                                onCheckedChange={() => toggleSelectUser(u.id)}
                              />
                            </TableCell>
                            <TableCell className="text-slate-300 text-sm">
                              <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-full ${avatarColor(u.first_name + u.last_name)} flex items-center justify-center text-xs font-semibold text-white shrink-0`}>
                                  {userInitials(u.first_name, u.last_name)}
                                </div>
                                <span className="font-medium text-white text-sm">
                                  {u.first_name} {u.last_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">{u.email}</TableCell>
                            <TableCell className="text-slate-300 text-sm">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                                {roleLabel(u.role)}
                              </span>
                            </TableCell>
                            <TableCell className="text-slate-300 text-sm">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                                <span className={`text-xs font-medium ${u.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  {u.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {u.last_login
                                ? formatDistanceToNow(new Date(u.last_login), { addSuffix: true })
                                : 'Never'}
                            </TableCell>
                            <TableCell className="text-slate-300 text-sm pr-4">
                              <div className="flex items-center justify-end gap-0.5">
                                <button
                                  className="h-8 w-8 p-0 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                                  onClick={() => openEditUser(u)}
                                  title="Edit user"
                                >
                                  <Edit className="h-3.5 w-3.5 text-slate-400" />
                                </button>
                                <button
                                  className="h-8 w-8 p-0 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                                  onClick={() => { setResetPwdTarget(u); setResetPwdOpen(true); }}
                                  title="Reset password"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                                </button>
                                <button
                                  className="h-8 w-8 p-0 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
                                  onClick={() => { setDeleteUserTarget(u); setDeleteUserOpen(true); }}
                                  title="Delete user"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-400 transition-colors" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {(!userSearch.trim() && roleFilter === 'all') ? (
                <DataPagination
                  page={usersPage}
                  totalPages={usersPagination.totalPages}
                  total={usersPagination.total}
                  pageSize={20}
                  onPageChange={setUsersPage}
                />
              ) : (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500">
                  Showing {filteredUsers.length} of {usersPagination.total} users
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ================================================================
            AUDIT LOGS TAB
        ================================================================ */}
        <TabsContent value="audit-logs">
          <div className="rounded-2xl" style={glassCard}>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Activity Log</h3>
                  <p className="text-sm text-slate-400 mt-0.5">Track platform activity and user actions.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={auditActionFilter} onValueChange={v => { setAuditActionFilter(v); setAuditPage(1); }}>
                    <SelectTrigger className="w-[180px] h-10 text-sm rounded-xl text-white border-0" style={glassInput}>
                      <SelectValue placeholder="Filter by action" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-0" style={selectDrop}>
                      <SelectItem value="all" className="text-slate-200 focus:bg-white/10 focus:text-white">All Actions</SelectItem>
                      {auditActions.map(a => (
                        <SelectItem key={a} value={a} className="text-slate-200 focus:bg-white/10 focus:text-white">{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--orbis-input)', color: '#94a3b8' }}>
                    {auditTotal} entries
                  </span>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--orbis-border)' }}>
                <Table>
                  <TableHeader style={{ background: 'var(--orbis-subtle)' }}>
                    <TableRow className="hover:bg-transparent" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Timestamp</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>User</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Action</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Resource</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-16">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-500 mx-auto mb-2" />
                          <span className="text-sm text-slate-500">Loading audit logs...</span>
                        </TableCell>
                      </TableRow>
                    ) : auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-16">
                          <Clock className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                          <span className="text-sm text-slate-500">No audit log entries yet.</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map(log => (
                        <TableRow key={log.id} className="hover:bg-white/[0.02]" style={{ borderBottom: '1px solid var(--orbis-grid)' }}>
                          <TableCell className="text-slate-400 text-sm whitespace-nowrap">
                            {log.created_at ? format(new Date(log.created_at), 'MMM d, yyyy HH:mm') : '--'}
                          </TableCell>
                          <TableCell className="text-white text-sm font-medium">
                            {log.user_email || `User #${log.user_id}`}
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm">
                            <span className="text-xs font-medium rounded-full px-2.5 py-1" style={{ background: 'var(--orbis-input)', color: '#94a3b8' }}>{log.action}</span>
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">
                            {log.resource_type ? `${log.resource_type}${log.resource_id ? ` #${log.resource_id}` : ''}` : '--'}
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm max-w-[300px] truncate">
                            {log.details || '--'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <DataPagination
                page={auditPage}
                totalPages={auditPagination.totalPages}
                total={auditPagination.total}
                pageSize={20}
                onPageChange={setAuditPage}
              />
            </div>
          </div>
        </TabsContent>

        {/* ================================================================
            OFFER TEMPLATES TAB
        ================================================================ */}
        <TabsContent value="offer-templates">
          <div className="rounded-2xl" style={glassCard}>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Offer Templates</h3>
                  <p className="text-sm text-slate-400 mt-0.5">Create and manage document templates for offer letters and HR documents.</p>
                </div>
                <button onClick={() => setCreateTemplateOpen(true)} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
                  <Plus className="h-4 w-4" /> Create Template
                </button>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--orbis-border)' }}>
                <Table>
                  <TableHeader style={{ background: 'var(--orbis-subtle)' }}>
                    <TableRow className="hover:bg-transparent" style={{ borderBottom: '1px solid var(--orbis-border)' }}>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Name</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Category</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Created</TableHead>
                      <TableHead className="text-slate-500 text-xs font-medium text-right pr-4" style={{ borderBottom: '1px solid var(--orbis-border)' }}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templatesLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-16">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-500 mx-auto mb-2" />
                          <span className="text-sm text-slate-500">Loading templates...</span>
                        </TableCell>
                      </TableRow>
                    ) : templates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-16">
                          <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                          <span className="text-sm text-slate-500">No templates created yet. Click "Create Template" to get started.</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      templates.map(t => (
                        <TableRow key={t.id} className="hover:bg-white/[0.02]" style={{ borderBottom: '1px solid var(--orbis-grid)' }}>
                          <TableCell className="text-slate-300 text-sm">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--orbis-input)' }}>
                                <FileText className="h-4 w-4 text-slate-400" />
                              </div>
                              <span className="text-sm font-medium text-white">{t.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm">
                            <span className="text-xs font-medium rounded-full px-2.5 py-1" style={{ background: 'var(--orbis-input)', color: '#94a3b8' }}>
                              {t.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">
                            {format(new Date(t.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm pr-4">
                            <div className="flex items-center justify-end gap-0.5">
                              <button className="h-8 w-8 p-0 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5" onClick={() => openEditTemplate(t)} title="Edit template">
                                <Edit className="h-3.5 w-3.5 text-slate-400" />
                              </button>
                              <button
                                className="h-8 w-8 p-0 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
                                onClick={() => { setDeleteTemplateTarget(t); setDeleteTemplateOpen(true); }}
                                title="Delete template"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-400 transition-colors" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <DataPagination
                page={templatesPage}
                totalPages={templatesPagination.totalPages}
                total={templatesPagination.total}
                pageSize={20}
                onPageChange={setTemplatesPage}
              />
            </div>
          </div>
        </TabsContent>

        {/* ================================================================
            ATS SETTINGS TAB
        ================================================================ */}
        <TabsContent value="ats-settings">
          <ATSSettingsPanel />
        </TabsContent>

        {/* ================================================================
            PROVIDERS TAB
        ================================================================ */}
        <TabsContent value="providers">
          <ProviderSettingsPanel />
        </TabsContent>
      </Tabs>

      {/* ==================================================================
          DIALOGS
      ================================================================== */}

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="sm:max-w-md border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">Create New User</DialogTitle>
            <DialogDescription className="text-slate-400">Add a new user to the platform.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cu-fname" className="text-sm font-medium text-slate-300">First Name</label>
                <input
                  id="cu-fname"
                  value={createUserForm.first_name}
                  onChange={e => setCreateUserForm(p => ({ ...p, first_name: e.target.value }))}
                  className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  style={glassInput}
                  placeholder="John"
                />
              </div>
              <div>
                <label htmlFor="cu-lname" className="text-sm font-medium text-slate-300">Last Name</label>
                <input
                  id="cu-lname"
                  value={createUserForm.last_name}
                  onChange={e => setCreateUserForm(p => ({ ...p, last_name: e.target.value }))}
                  className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  style={glassInput}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <label htmlFor="cu-email" className="text-sm font-medium text-slate-300">Email Address</label>
              <input
                id="cu-email"
                type="email"
                value={createUserForm.email}
                onChange={e => setCreateUserForm(p => ({ ...p, email: e.target.value }))}
                className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                style={glassInput}
                placeholder="john@company.com"
              />
            </div>
            <div>
              <label htmlFor="cu-password" className="text-sm font-medium text-slate-300">Password</label>
              <input
                id="cu-password"
                type="password"
                value={createUserForm.password}
                onChange={e => setCreateUserForm(p => ({ ...p, password: e.target.value }))}
                className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                style={glassInput}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Role</label>
              <Select value={createUserForm.role} onValueChange={(v: any) => setCreateUserForm(p => ({ ...p, role: v }))}>
                <SelectTrigger className="mt-1.5 h-10 text-sm rounded-xl text-white border-0" style={glassInput}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>
                  <SelectItem value="admin" className="text-slate-200 focus:bg-white/10 focus:text-white">Admin</SelectItem>
                  <SelectItem value="hr" className="text-slate-200 focus:bg-white/10 focus:text-white">HR</SelectItem>
                  <SelectItem value="hiring_manager" className="text-slate-200 focus:bg-white/10 focus:text-white">Hiring Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setCreateUserOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:bg-white/5" style={{ ...glassCard }}>Cancel</button>
            <button onClick={handleCreateUser} disabled={createUserLoading} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              {createUserLoading ? <span className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Creating...</span> : 'Create User'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="sm:max-w-md border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">Edit User</DialogTitle>
            <DialogDescription className="text-slate-400">Update user information for {editUserTarget?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="eu-fname" className="text-sm font-medium text-slate-300">First Name</label>
                <input
                  id="eu-fname"
                  value={editUserForm.first_name}
                  onChange={e => setEditUserForm(p => ({ ...p, first_name: e.target.value }))}
                  className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  style={glassInput}
                />
              </div>
              <div>
                <label htmlFor="eu-lname" className="text-sm font-medium text-slate-300">Last Name</label>
                <input
                  id="eu-lname"
                  value={editUserForm.last_name}
                  onChange={e => setEditUserForm(p => ({ ...p, last_name: e.target.value }))}
                  className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                  style={glassInput}
                />
              </div>
            </div>
            <div>
              <label htmlFor="eu-email" className="text-sm font-medium text-slate-300">Email Address</label>
              <input
                id="eu-email"
                type="email"
                value={editUserForm.email}
                onChange={e => setEditUserForm(p => ({ ...p, email: e.target.value }))}
                className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                style={glassInput}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Role</label>
              <Select value={editUserForm.role} onValueChange={(v: any) => setEditUserForm(p => ({ ...p, role: v }))}>
                <SelectTrigger className="mt-1.5 h-10 text-sm rounded-xl text-white border-0" style={glassInput}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>
                  <SelectItem value="admin" className="text-slate-200 focus:bg-white/10 focus:text-white">Admin</SelectItem>
                  <SelectItem value="hr" className="text-slate-200 focus:bg-white/10 focus:text-white">HR</SelectItem>
                  <SelectItem value="hiring_manager" className="text-slate-200 focus:bg-white/10 focus:text-white">Hiring Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg p-3" style={{ border: '1px solid var(--orbis-border)' }}>
              <label className="text-sm font-medium text-slate-300">Active Status</label>
              <Switch checked={editUserForm.is_active} onCheckedChange={v => setEditUserForm(p => ({ ...p, is_active: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setEditUserOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:bg-white/5" style={{ ...glassCard }}>Cancel</button>
            <button onClick={handleEditUser} disabled={editUserLoading} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              {editUserLoading ? <span className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Saving...</span> : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirm Dialog */}
      <Dialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
        <DialogContent className="sm:max-w-sm border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full mb-2" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <DialogTitle className="text-white text-lg font-semibold">Delete User</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete <strong className="text-white">{deleteUserTarget?.first_name} {deleteUserTarget?.last_name}</strong> ({deleteUserTarget?.email})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button onClick={() => setDeleteUserOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:bg-white/5" style={{ ...glassCard }}>Cancel</button>
            <button onClick={handleDeleteUser} disabled={deleteUserLoading} className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {deleteUserLoading ? <span className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</span> : 'Delete User'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Confirm Dialog */}
      <Dialog open={resetPwdOpen} onOpenChange={setResetPwdOpen}>
        <DialogContent className="sm:max-w-sm border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full mb-2" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <KeyRound className="h-5 w-5 text-amber-400" />
            </div>
            <DialogTitle className="text-white text-lg font-semibold">Reset Password</DialogTitle>
            <DialogDescription className="text-slate-400">
              Set a new password for <strong className="text-white">{resetPwdTarget?.first_name} {resetPwdTarget?.last_name}</strong>. They will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-slate-300">New Password</label>
            <input
              type="password"
              placeholder="Enter new password"
              value={resetPwdNewPassword}
              onChange={(e) => setResetPwdNewPassword(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              style={glassInput}
            />
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => { setResetPwdOpen(false); setResetPwdNewPassword(''); }} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:bg-white/5" style={{ ...glassCard }}>Cancel</button>
            <button onClick={handleResetPassword} disabled={resetPwdLoading || !resetPwdNewPassword.trim()} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              {resetPwdLoading ? <span className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Resetting...</span> : 'Reset Password'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen}>
        <DialogContent className="sm:max-w-lg border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">Create Template</DialogTitle>
            <DialogDescription className="text-slate-400">Add a new offer or document template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div>
              <label htmlFor="ct-name" className="text-sm font-medium text-slate-300">Template Name</label>
              <input
                id="ct-name"
                value={createTemplateForm.name}
                onChange={e => setCreateTemplateForm(p => ({ ...p, name: e.target.value }))}
                className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                style={glassInput}
                placeholder="e.g. Standard Offer Letter"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Category</label>
              <Select value={createTemplateForm.category} onValueChange={v => setCreateTemplateForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="mt-1.5 h-10 text-sm rounded-xl text-white border-0" style={glassInput}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>
                  {templateCategories.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-slate-200 focus:bg-white/10 focus:text-white">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="ct-content" className="text-sm font-medium text-slate-300">Content</label>
              <textarea
                id="ct-content"
                value={createTemplateForm.content}
                onChange={e => setCreateTemplateForm(p => ({ ...p, content: e.target.value }))}
                className="mt-1.5 w-full min-h-[150px] px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all resize-y"
                style={glassInput}
                placeholder="Enter template content..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setCreateTemplateOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:bg-white/5" style={{ ...glassCard }}>Cancel</button>
            <button onClick={handleCreateTemplate} disabled={createTemplateLoading} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              {createTemplateLoading ? <span className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Creating...</span> : 'Create Template'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={editTemplateOpen} onOpenChange={setEditTemplateOpen}>
        <DialogContent className="sm:max-w-lg border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">Edit Template</DialogTitle>
            <DialogDescription className="text-slate-400">Update the template "{editTemplateTarget?.name}".</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div>
              <label htmlFor="et-name" className="text-sm font-medium text-slate-300">Template Name</label>
              <input
                id="et-name"
                value={editTemplateForm.name}
                onChange={e => setEditTemplateForm(p => ({ ...p, name: e.target.value }))}
                className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                style={glassInput}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Category</label>
              <Select value={editTemplateForm.category} onValueChange={v => setEditTemplateForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="mt-1.5 h-10 text-sm rounded-xl text-white border-0" style={glassInput}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>
                  {templateCategories.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-slate-200 focus:bg-white/10 focus:text-white">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="et-content" className="text-sm font-medium text-slate-300">Content</label>
              <textarea
                id="et-content"
                value={editTemplateForm.content}
                onChange={e => setEditTemplateForm(p => ({ ...p, content: e.target.value }))}
                className="mt-1.5 w-full min-h-[150px] px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all resize-y"
                style={glassInput}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setEditTemplateOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:bg-white/5" style={{ ...glassCard }}>Cancel</button>
            <button onClick={handleEditTemplate} disabled={editTemplateLoading} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              {editTemplateLoading ? <span className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Saving...</span> : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirm Dialog */}
      <Dialog open={deleteTemplateOpen} onOpenChange={setDeleteTemplateOpen}>
        <DialogContent className="sm:max-w-sm border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full mb-2" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <DialogTitle className="text-white text-lg font-semibold">Delete Template</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete <strong className="text-white">{deleteTemplateTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button onClick={() => setDeleteTemplateOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:bg-white/5" style={{ ...glassCard }}>Cancel</button>
            <button onClick={handleDeleteTemplate} disabled={deleteTemplateLoading} className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {deleteTemplateLoading ? <span className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</span> : 'Delete Template'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminDashboard;
