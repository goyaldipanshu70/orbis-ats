import { useState, useEffect, useCallback, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, AdminUser } from '@/utils/api';
import { DataPagination } from '@/components/DataPagination';
import {
  Shield, Users, Activity, Briefcase, UserPlus, Edit, Trash2,
  Search, KeyRound, RotateCcw, FileText, Clock, AlertTriangle, Plus, UserCog, Loader2,
  Mail, Phone, Bot, CheckCircle2, XCircle, Settings2,
} from 'lucide-react';
import { CountingNumber } from '@/components/ui/counting-number';
import { Fade } from '@/components/ui/fade';
import { motion, AnimatePresence } from 'framer-motion';
import { scaleIn, fadeInUp, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { format, formatDistanceToNow } from 'date-fns';

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

function roleBadgeVariant(role: string): { bg: string; text: string; dot: string } {
  switch (role) {
    case 'admin':
      return { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' };
    case 'hr':
      return { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' };
    case 'hiring_manager':
      return { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' };
    default:
      return { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' };
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
    'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600',
    'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Rejection Lock */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Rejection Lock Period</CardTitle>
              <CardDescription className="text-xs">Block rejected candidates from reapplying.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm font-medium">Enable Rejection Lock</Label>
            <Switch
              checked={settings.rejection_lock_enabled}
              onCheckedChange={v => setSettings(s => ({ ...s, rejection_lock_enabled: v }))}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Default Lock Period (days)</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={settings.default_rejection_lock_days}
              onChange={e => setSettings(s => ({ ...s, default_rejection_lock_days: Math.max(0, parseInt(e.target.value) || 0) }))}
              className="mt-1.5 w-32"
              disabled={!settings.rejection_lock_enabled}
            />
            <p className="text-xs text-muted-foreground mt-1.5">Individual jobs can override this default.</p>
          </div>
        </CardContent>
      </Card>

      {/* OTP Verification */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/40">
              <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">OTP Verification</CardTitle>
              <CardDescription className="text-xs">Email and phone verification for signup.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm font-medium">Require Email Verification</Label>
            <Switch
              checked={settings.otp_email_required}
              onCheckedChange={v => setSettings(s => ({ ...s, otp_email_required: v }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm font-medium">Require Phone Verification</Label>
            <Switch
              checked={settings.otp_phone_required}
              onCheckedChange={v => setSettings(s => ({ ...s, otp_phone_required: v }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">OTP Expiry (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={settings.otp_expiry_minutes}
                onChange={e => setSettings(s => ({ ...s, otp_expiry_minutes: Math.max(1, parseInt(e.target.value) || 10) }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Max Attempts</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={settings.otp_max_attempts}
                onChange={e => setSettings(s => ({ ...s, otp_max_attempts: Math.max(1, parseInt(e.target.value) || 5) }))}
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="md:col-span-2 flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="rounded-lg">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : 'Save ATS Settings'}
        </Button>
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
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* -- Email Provider -- */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/40">
              <Mail className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Email Provider</CardTitle>
              <CardDescription className="text-xs">OTP, notifications, and offer letters.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Provider</Label>
            <Select value={emailSettings.provider} onValueChange={v => setEmailSettings(s => ({ ...s, provider: v }))}>
              <SelectTrigger className="mt-1.5 h-9 text-sm w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="mailgun">Mailgun</SelectItem>
                <SelectItem value="smtp">SMTP</SelectItem>
                <SelectItem value="ses">AWS SES</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(emailSettings.provider === 'sendgrid' || emailSettings.provider === 'mailgun') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">API Key</Label>
                <Input type="password" value={emailSettings.api_key || ''} onChange={e => setEmailSettings(s => ({ ...s, api_key: e.target.value }))} className="mt-1.5 h-9 text-sm" placeholder="API key" />
              </div>
              <div>
                <Label className="text-sm font-medium">{emailSettings.provider === 'mailgun' ? 'Domain' : 'From Email'}</Label>
                <Input value={emailSettings.provider === 'mailgun' ? (emailSettings.smtp_host || '') : (emailSettings.smtp_user || '')} onChange={e => setEmailSettings(s => emailSettings.provider === 'mailgun' ? ({ ...s, smtp_host: e.target.value }) : ({ ...s, smtp_user: e.target.value }))} className="mt-1.5 h-9 text-sm" placeholder={emailSettings.provider === 'mailgun' ? 'mg.example.com' : 'noreply@example.com'} />
              </div>
            </div>
          )}

          {emailSettings.provider === 'smtp' && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-sm font-medium">SMTP Host</Label><Input value={emailSettings.smtp_host || ''} onChange={e => setEmailSettings(s => ({ ...s, smtp_host: e.target.value }))} className="mt-1.5 h-9 text-sm" placeholder="smtp.gmail.com" /></div>
              <div><Label className="text-sm font-medium">SMTP Port</Label><Input type="number" value={emailSettings.smtp_port || 587} onChange={e => setEmailSettings(s => ({ ...s, smtp_port: parseInt(e.target.value) || 587 }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">Username</Label><Input value={emailSettings.smtp_user || ''} onChange={e => setEmailSettings(s => ({ ...s, smtp_user: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">Password</Label><Input type="password" value={emailSettings.smtp_password || ''} onChange={e => setEmailSettings(s => ({ ...s, smtp_password: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
            </div>
          )}

          {emailSettings.provider === 'ses' && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-sm font-medium">AWS Access Key ID</Label><Input value={emailSettings.aws_access_key_id || ''} onChange={e => setEmailSettings(s => ({ ...s, aws_access_key_id: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">AWS Secret Access Key</Label><Input type="password" value={emailSettings.aws_secret_access_key || ''} onChange={e => setEmailSettings(s => ({ ...s, aws_secret_access_key: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">AWS Region</Label><Input value={emailSettings.aws_region || 'us-east-1'} onChange={e => setEmailSettings(s => ({ ...s, aws_region: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">From Email</Label><Input value={emailSettings.ses_from_email || ''} onChange={e => setEmailSettings(s => ({ ...s, ses_from_email: e.target.value }))} className="mt-1.5 h-9 text-sm" placeholder="noreply@example.com" /></div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t">
            <Button onClick={saveEmail} disabled={emailSaving} size="sm" className="rounded-lg">
              {emailSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving...</> : 'Save'}
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <Input value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)} className="h-9 text-sm w-56" placeholder="test@example.com" />
              <Button variant="outline" size="sm" onClick={testEmail} disabled={emailTesting} className="rounded-lg">
                {emailTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Mail className="h-3.5 w-3.5 mr-1.5" />} Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* -- SMS Provider -- */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/40">
              <Phone className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">SMS Provider</CardTitle>
              <CardDescription className="text-xs">OTP verification and notifications.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Provider</Label>
            <Select value={smsSettings.provider} onValueChange={v => setSmsSettings(s => ({ ...s, provider: v }))}>
              <SelectTrigger className="mt-1.5 h-9 text-sm w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="twilio">Twilio</SelectItem>
                <SelectItem value="vonage">Vonage</SelectItem>
                <SelectItem value="sns">AWS SNS</SelectItem>
                <SelectItem value="messagebird">MessageBird</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {smsSettings.provider === 'twilio' && (
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-sm font-medium">Account SID</Label><Input value={smsSettings.twilio_account_sid} onChange={e => setSmsSettings(s => ({ ...s, twilio_account_sid: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">Auth Token</Label><Input type="password" value={smsSettings.twilio_auth_token} onChange={e => setSmsSettings(s => ({ ...s, twilio_auth_token: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">From Number</Label><Input value={smsSettings.twilio_from_number} onChange={e => setSmsSettings(s => ({ ...s, twilio_from_number: e.target.value }))} className="mt-1.5 h-9 text-sm" placeholder="+1234567890" /></div>
            </div>
          )}

          {smsSettings.provider === 'vonage' && (
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-sm font-medium">API Key</Label><Input value={smsSettings.vonage_api_key} onChange={e => setSmsSettings(s => ({ ...s, vonage_api_key: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">API Secret</Label><Input type="password" value={smsSettings.vonage_api_secret} onChange={e => setSmsSettings(s => ({ ...s, vonage_api_secret: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">From Number</Label><Input value={smsSettings.vonage_from_number} onChange={e => setSmsSettings(s => ({ ...s, vonage_from_number: e.target.value }))} className="mt-1.5 h-9 text-sm" placeholder="Intesa" /></div>
            </div>
          )}

          {smsSettings.provider === 'sns' && (
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-sm font-medium">AWS Access Key ID</Label><Input value={smsSettings.aws_access_key_id} onChange={e => setSmsSettings(s => ({ ...s, aws_access_key_id: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">AWS Secret Access Key</Label><Input type="password" value={smsSettings.aws_secret_access_key} onChange={e => setSmsSettings(s => ({ ...s, aws_secret_access_key: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">AWS Region</Label><Input value={smsSettings.aws_region} onChange={e => setSmsSettings(s => ({ ...s, aws_region: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
            </div>
          )}

          {smsSettings.provider === 'messagebird' && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-sm font-medium">Access Key</Label><Input type="password" value={smsSettings.messagebird_access_key} onChange={e => setSmsSettings(s => ({ ...s, messagebird_access_key: e.target.value }))} className="mt-1.5 h-9 text-sm" /></div>
              <div><Label className="text-sm font-medium">Originator</Label><Input value={smsSettings.messagebird_originator} onChange={e => setSmsSettings(s => ({ ...s, messagebird_originator: e.target.value }))} className="mt-1.5 h-9 text-sm" placeholder="Intesa" /></div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t">
            <Button onClick={saveSms} disabled={smsSaving} size="sm" className="rounded-lg">
              {smsSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving...</> : 'Save'}
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <Input value={testSmsTo} onChange={e => setTestSmsTo(e.target.value)} className="h-9 text-sm w-56" placeholder="+1234567890" />
              <Button variant="outline" size="sm" onClick={testSms} disabled={smsTesting} className="rounded-lg">
                {smsTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Phone className="h-3.5 w-3.5 mr-1.5" />} Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* -- AI Provider -- */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40">
              <Bot className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">AI Provider</CardTitle>
              <CardDescription className="text-xs">JD analysis, resume scoring, interviews, and RAG.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Provider</Label>
            <Select value={aiSettings.provider} onValueChange={v => setAiSettings(s => ({ ...s, provider: v }))}>
              <SelectTrigger className="mt-1.5 h-9 text-sm w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {aiSettings.provider === 'openai' && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-sm font-medium">API Key</Label><Input type="password" value={aiSettings.openai_api_key} onChange={e => setAiSettings(s => ({ ...s, openai_api_key: e.target.value }))} className="mt-1.5 h-9 text-sm" placeholder="sk-..." /></div>
              <div>
                <Label className="text-sm font-medium">Model</Label>
                <Select value={aiSettings.openai_model} onValueChange={v => setAiSettings(s => ({ ...s, openai_model: v }))}>
                  <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {aiSettings.provider === 'anthropic' && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-sm font-medium">API Key</Label><Input type="password" value={aiSettings.anthropic_api_key} onChange={e => setAiSettings(s => ({ ...s, anthropic_api_key: e.target.value }))} className="mt-1.5 h-9 text-sm" placeholder="sk-ant-..." /></div>
              <div>
                <Label className="text-sm font-medium">Model</Label>
                <Select value={aiSettings.anthropic_model} onValueChange={v => setAiSettings(s => ({ ...s, anthropic_model: v }))}>
                  <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                    <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {aiSettings.provider === 'gemini' && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-sm font-medium">API Key</Label><Input type="password" value={aiSettings.google_api_key} onChange={e => setAiSettings(s => ({ ...s, google_api_key: e.target.value }))} className="mt-1.5 h-9 text-sm" placeholder="AIza..." /></div>
              <div>
                <Label className="text-sm font-medium">Model</Label>
                <Select value={aiSettings.google_model} onValueChange={v => setAiSettings(s => ({ ...s, google_model: v }))}>
                  <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="gemini-2.0-pro">Gemini 2.0 Pro</SelectItem>
                    <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                    <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t">
            <Button onClick={saveAi} disabled={aiSaving} size="sm" className="rounded-lg">
              {aiSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving...</> : 'Save'}
            </Button>
            <Button variant="outline" size="sm" onClick={testAi} disabled={aiTesting} className="rounded-lg">
              {aiTesting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Testing...</> : <><Bot className="h-3.5 w-3.5 mr-1.5" /> Test Connection</>}
            </Button>
            {aiTestResult && (
              <span className={`text-xs font-medium ${aiTestResult.includes('OK') || aiTestResult.includes('successful') ? 'text-emerald-600' : 'text-red-500'}`}>
                {aiTestResult}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
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
        { label: 'Total Users', value: stats.total_users, icon: Users, bg: 'bg-blue-100 dark:bg-blue-950/40', fg: 'text-blue-600 dark:text-blue-400' },
        { label: 'Admin Users', value: stats.admin_users, icon: Shield, bg: 'bg-purple-100 dark:bg-purple-950/40', fg: 'text-purple-600 dark:text-purple-400' },
        { label: 'HR Users', value: stats.hr_users, icon: UserCog, bg: 'bg-violet-100 dark:bg-violet-950/40', fg: 'text-violet-600 dark:text-violet-400' },
        { label: 'Active Sessions', value: stats.active_sessions, icon: Activity, bg: 'bg-amber-100 dark:bg-amber-950/40', fg: 'text-amber-600 dark:text-amber-400' },
        { label: 'Total Jobs', value: stats.total_jobs, icon: Briefcase, bg: 'bg-cyan-100 dark:bg-cyan-950/40', fg: 'text-cyan-600 dark:text-cyan-400' },
        { label: 'Total Candidates', value: stats.total_candidates, icon: Users, bg: 'bg-rose-100 dark:bg-rose-950/40', fg: 'text-rose-600 dark:text-rose-400' },
      ]
    : [];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <AppLayout>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System administration and configuration
        </p>
      </div>

      {/* Stats row */}
      <StaggerGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statsLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse rounded-xl">
                <CardContent className="p-4">
                  <div className="h-9 w-9 rounded-lg bg-muted mb-3" />
                  <div className="h-7 w-12 bg-muted rounded mb-1" />
                  <div className="h-4 w-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))
          : statCards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.div key={card.label} variants={scaleIn}>
                <Card className="rounded-xl border shadow-sm hover:shadow-md transition-all duration-200">
                  <CardContent className="p-4">
                    <div className={`h-9 w-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                      <Icon className={`h-4.5 w-4.5 ${card.fg}`} />
                    </div>
                    <p className="text-2xl font-bold text-foreground tracking-tight">
                      <CountingNumber value={card.value} />
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">{card.label}</p>
                  </CardContent>
                </Card>
                </motion.div>
              );
            })}
      </StaggerGrid>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <div className="border-b">
          <TabsList className="bg-transparent h-auto p-0 gap-0 flex">
            <TabsTrigger
              value="users"
              className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground transition-colors"
            >
              <Users className="h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger
              value="audit-logs"
              className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground transition-colors"
            >
              <Clock className="h-4 w-4" /> Audit Logs
            </TabsTrigger>
            <TabsTrigger
              value="offer-templates"
              className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground transition-colors"
            >
              <FileText className="h-4 w-4" /> Offer Templates
            </TabsTrigger>
            <TabsTrigger
              value="ats-settings"
              className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground transition-colors"
            >
              <Shield className="h-4 w-4" /> ATS Settings
            </TabsTrigger>
            <TabsTrigger
              value="providers"
              className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground transition-colors"
            >
              <Settings2 className="h-4 w-4" /> Providers
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ================================================================
            USERS TAB
        ================================================================ */}
        <TabsContent value="users" asChild>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-6">
              {/* Top action bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="pl-9 h-9 text-sm rounded-lg"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                    <SelectTrigger className="w-[160px] h-9 text-sm rounded-lg">
                      <SelectValue placeholder="Filter role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                      <SelectItem value="interviewer">Interviewer</SelectItem>
                      <SelectItem value="candidate">Candidate</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedUserIds.size > 0 && (
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="rounded-lg">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete ({selectedUserIds.size})
                    </Button>
                  )}
                </div>
                <Button onClick={() => setCreateUserOpen(true)} size="sm" className="rounded-lg">
                  <UserPlus className="h-4 w-4 mr-1.5" /> Create User
                </Button>
              </div>

              {/* Users table */}
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-12 pl-4">
                        <Checkbox
                          checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">User</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Email</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Role</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Last Login</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-16">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto mb-2" />
                          <span className="text-sm text-muted-foreground">Loading users...</span>
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-16">
                          <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                          <span className="text-sm text-muted-foreground">No users found.</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u, index) => {
                        const badge = roleBadgeVariant(u.role);
                        return (
                          <motion.tr
                            key={u.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.03 }}
                            className="border-b transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted/50"
                            data-state={selectedUserIds.has(u.id) ? 'selected' : undefined}
                          >
                            <TableCell className="pl-4">
                              <Checkbox
                                checked={selectedUserIds.has(u.id)}
                                onCheckedChange={() => toggleSelectUser(u.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-full ${avatarColor(u.first_name + u.last_name)} flex items-center justify-center text-xs font-semibold text-white shrink-0`}>
                                  {userInitials(u.first_name, u.last_name)}
                                </div>
                                <span className="font-medium text-foreground text-sm">
                                  {u.first_name} {u.last_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                                {roleLabel(u.role)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                <span className={`text-xs font-medium ${u.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                  {u.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {u.last_login
                                ? formatDistanceToNow(new Date(u.last_login), { addSuffix: true })
                                : 'Never'}
                            </TableCell>
                            <TableCell className="pr-4">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                                  onClick={() => openEditUser(u)}
                                  title="Edit user"
                                >
                                  <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                                  onClick={() => { setResetPwdTarget(u); setResetPwdOpen(true); }}
                                  title="Reset password"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                  onClick={() => { setDeleteUserTarget(u); setDeleteUserOpen(true); }}
                                  title="Delete user"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500 transition-colors" />
                                </Button>
                              </div>
                            </TableCell>
                          </motion.tr>
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
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                  Showing {filteredUsers.length} of {usersPagination.total} users
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
        </TabsContent>

        {/* ================================================================
            AUDIT LOGS TAB
        ================================================================ */}
        <TabsContent value="audit-logs" asChild>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Activity Log</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Track platform activity and user actions.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={auditActionFilter} onValueChange={v => { setAuditActionFilter(v); setAuditPage(1); }}>
                    <SelectTrigger className="w-[180px] h-9 text-sm rounded-lg">
                      <SelectValue placeholder="Filter by action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {auditActions.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary" className="text-xs px-2.5 py-1 rounded-full font-medium">
                    {auditTotal} entries
                  </Badge>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Timestamp</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">User</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Action</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Resource</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-16">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto mb-2" />
                          <span className="text-sm text-muted-foreground">Loading audit logs...</span>
                        </TableCell>
                      </TableRow>
                    ) : auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-16">
                          <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                          <span className="text-sm text-muted-foreground">No audit log entries yet.</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map(log => (
                        <TableRow key={log.id} className="hover:bg-muted/30">
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {log.created_at ? format(new Date(log.created_at), 'MMM d, yyyy HH:mm') : '--'}
                          </TableCell>
                          <TableCell className="text-sm text-foreground font-medium">
                            {log.user_email || `User #${log.user_id}`}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs font-medium rounded-full">{log.action}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.resource_type ? `${log.resource_type}${log.resource_id ? ` #${log.resource_id}` : ''}` : '--'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
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
            </CardContent>
          </Card>
          </motion.div>
        </TabsContent>

        {/* ================================================================
            OFFER TEMPLATES TAB
        ================================================================ */}
        <TabsContent value="offer-templates" asChild>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Offer Templates</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Create and manage document templates for offer letters and HR documents.</p>
                </div>
                <Button onClick={() => setCreateTemplateOpen(true)} size="sm" className="rounded-lg">
                  <Plus className="h-4 w-4 mr-1.5" /> Create Template
                </Button>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Name</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Category</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Created</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templatesLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-16">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto mb-2" />
                          <span className="text-sm text-muted-foreground">Loading templates...</span>
                        </TableCell>
                      </TableRow>
                    ) : templates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-16">
                          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                          <span className="text-sm text-muted-foreground">No templates created yet. Click "Create Template" to get started.</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      templates.map(t => (
                        <TableRow key={t.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <span className="text-sm font-medium text-foreground">{t.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs font-medium rounded-full">
                              {t.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(t.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="pr-4">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-muted" onClick={() => openEditTemplate(t)} title="Edit template">
                                <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => { setDeleteTemplateTarget(t); setDeleteTemplateOpen(true); }}
                                title="Delete template"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500 transition-colors" />
                              </Button>
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
            </CardContent>
          </Card>
          </motion.div>
        </TabsContent>

        {/* ================================================================
            ATS SETTINGS TAB
        ================================================================ */}
        <TabsContent value="ats-settings" asChild>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ATSSettingsPanel />
          </motion.div>
        </TabsContent>

        {/* ================================================================
            PROVIDERS TAB
        ================================================================ */}
        <TabsContent value="providers" asChild>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ProviderSettingsPanel />
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* ==================================================================
          DIALOGS
      ================================================================== */}

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Create New User</DialogTitle>
            <DialogDescription>Add a new user to the platform.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cu-fname" className="text-sm font-medium">First Name</Label>
                <Input
                  id="cu-fname"
                  value={createUserForm.first_name}
                  onChange={e => setCreateUserForm(p => ({ ...p, first_name: e.target.value }))}
                  className="mt-1.5 h-9 text-sm rounded-lg"
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="cu-lname" className="text-sm font-medium">Last Name</Label>
                <Input
                  id="cu-lname"
                  value={createUserForm.last_name}
                  onChange={e => setCreateUserForm(p => ({ ...p, last_name: e.target.value }))}
                  className="mt-1.5 h-9 text-sm rounded-lg"
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="cu-email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="cu-email"
                type="email"
                value={createUserForm.email}
                onChange={e => setCreateUserForm(p => ({ ...p, email: e.target.value }))}
                className="mt-1.5 h-9 text-sm rounded-lg"
                placeholder="john@company.com"
              />
            </div>
            <div>
              <Label htmlFor="cu-password" className="text-sm font-medium">Password</Label>
              <Input
                id="cu-password"
                type="password"
                value={createUserForm.password}
                onChange={e => setCreateUserForm(p => ({ ...p, password: e.target.value }))}
                className="mt-1.5 h-9 text-sm rounded-lg"
                placeholder="Minimum 8 characters"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Role</Label>
              <Select value={createUserForm.role} onValueChange={(v: any) => setCreateUserForm(p => ({ ...p, role: v }))}>
                <SelectTrigger className="mt-1.5 h-9 text-sm rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateUserOpen(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handleCreateUser} disabled={createUserLoading} className="rounded-lg">
              {createUserLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Creating...</> : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Edit User</DialogTitle>
            <DialogDescription>Update user information for {editUserTarget?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="eu-fname" className="text-sm font-medium">First Name</Label>
                <Input
                  id="eu-fname"
                  value={editUserForm.first_name}
                  onChange={e => setEditUserForm(p => ({ ...p, first_name: e.target.value }))}
                  className="mt-1.5 h-9 text-sm rounded-lg"
                />
              </div>
              <div>
                <Label htmlFor="eu-lname" className="text-sm font-medium">Last Name</Label>
                <Input
                  id="eu-lname"
                  value={editUserForm.last_name}
                  onChange={e => setEditUserForm(p => ({ ...p, last_name: e.target.value }))}
                  className="mt-1.5 h-9 text-sm rounded-lg"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="eu-email" className="text-sm font-medium">Email Address</Label>
              <Input
                id="eu-email"
                type="email"
                value={editUserForm.email}
                onChange={e => setEditUserForm(p => ({ ...p, email: e.target.value }))}
                className="mt-1.5 h-9 text-sm rounded-lg"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Role</Label>
              <Select value={editUserForm.role} onValueChange={(v: any) => setEditUserForm(p => ({ ...p, role: v }))}>
                <SelectTrigger className="mt-1.5 h-9 text-sm rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm font-medium">Active Status</Label>
              <Switch checked={editUserForm.is_active} onCheckedChange={v => setEditUserForm(p => ({ ...p, is_active: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditUserOpen(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handleEditUser} disabled={editUserLoading} className="rounded-lg">
              {editUserLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirm Dialog */}
      <Dialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-lg font-semibold">Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteUserTarget?.first_name} {deleteUserTarget?.last_name}</strong> ({deleteUserTarget?.email})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteUserOpen(false)} className="rounded-lg">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleteUserLoading} className="rounded-lg">
              {deleteUserLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Deleting...</> : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Confirm Dialog */}
      <Dialog open={resetPwdOpen} onOpenChange={setResetPwdOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40 mb-2">
              <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-lg font-semibold">Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{resetPwdTarget?.first_name} {resetPwdTarget?.last_name}</strong>. They will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-foreground">New Password</label>
            <Input
              type="password"
              placeholder="Enter new password"
              value={resetPwdNewPassword}
              onChange={(e) => setResetPwdNewPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setResetPwdOpen(false); setResetPwdNewPassword(''); }} className="rounded-lg">Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetPwdLoading || !resetPwdNewPassword.trim()} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
              {resetPwdLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Resetting...</> : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Create Template</DialogTitle>
            <DialogDescription>Add a new offer or document template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div>
              <Label htmlFor="ct-name" className="text-sm font-medium">Template Name</Label>
              <Input
                id="ct-name"
                value={createTemplateForm.name}
                onChange={e => setCreateTemplateForm(p => ({ ...p, name: e.target.value }))}
                className="mt-1.5 h-9 text-sm rounded-lg"
                placeholder="e.g. Standard Offer Letter"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Category</Label>
              <Select value={createTemplateForm.category} onValueChange={v => setCreateTemplateForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="mt-1.5 h-9 text-sm rounded-lg">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {templateCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ct-content" className="text-sm font-medium">Content</Label>
              <Textarea
                id="ct-content"
                value={createTemplateForm.content}
                onChange={e => setCreateTemplateForm(p => ({ ...p, content: e.target.value }))}
                className="mt-1.5 text-sm min-h-[150px] rounded-lg"
                placeholder="Enter template content..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateTemplateOpen(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={createTemplateLoading} className="rounded-lg">
              {createTemplateLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Creating...</> : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={editTemplateOpen} onOpenChange={setEditTemplateOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Edit Template</DialogTitle>
            <DialogDescription>Update the template "{editTemplateTarget?.name}".</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div>
              <Label htmlFor="et-name" className="text-sm font-medium">Template Name</Label>
              <Input
                id="et-name"
                value={editTemplateForm.name}
                onChange={e => setEditTemplateForm(p => ({ ...p, name: e.target.value }))}
                className="mt-1.5 h-9 text-sm rounded-lg"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Category</Label>
              <Select value={editTemplateForm.category} onValueChange={v => setEditTemplateForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="mt-1.5 h-9 text-sm rounded-lg">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {templateCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="et-content" className="text-sm font-medium">Content</Label>
              <Textarea
                id="et-content"
                value={editTemplateForm.content}
                onChange={e => setEditTemplateForm(p => ({ ...p, content: e.target.value }))}
                className="mt-1.5 text-sm min-h-[150px] rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTemplateOpen(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handleEditTemplate} disabled={editTemplateLoading} className="rounded-lg">
              {editTemplateLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirm Dialog */}
      <Dialog open={deleteTemplateOpen} onOpenChange={setDeleteTemplateOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-lg font-semibold">Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTemplateTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTemplateOpen(false)} className="rounded-lg">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTemplate} disabled={deleteTemplateLoading} className="rounded-lg">
              {deleteTemplateLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Deleting...</> : 'Delete Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminDashboard;
