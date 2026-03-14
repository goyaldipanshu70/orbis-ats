import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { CountingNumber } from '@/components/ui/counting-number';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { fadeInUp, scaleIn } from '@/lib/animations';
import {
  Globe2, Plus, Trash2, Pencil, Link2, Wifi, WifiOff, ExternalLink,
  Zap, Settings2, Shield, Rss, Monitor, Hand, KeyRound, Lock, Unplug,
  Play, PlugZap, Bot, Eye, EyeOff, CheckCircle, XCircle, Loader2,
  Send, Download, Upload, RefreshCw, Cable, Sparkles, Terminal,
  Network, ArrowRightLeft,
} from 'lucide-react';

// ── Design System Constants ──────────────────────────────────────────

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

const focusStyle: React.CSSProperties = { background: 'var(--orbis-hover)', borderColor: '#1B8EE5', boxShadow: '0 0 20px rgba(27,142,229,0.15)' };
const blurStyle: React.CSSProperties = { background: 'var(--orbis-input)', borderColor: 'var(--orbis-border)', boxShadow: 'none' };

function applyFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  Object.assign(e.target.style, focusStyle);
}
function applyBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  Object.assign(e.target.style, blurStyle);
}

// ── Types ─────────────────────────────────────────────────────────────

interface Portal {
  id: number;
  portal_name: string;
  api_endpoint?: string;
  auth_type?: string;
  auth_credentials?: Record<string, string>;
  has_credentials?: boolean;
  integration_type?: string;
  mcp_server_url?: string;
  mcp_transport?: string;
  mcp_tools?: Array<{ name: string; description: string }>;
  web_automation_config?: {
    login_url?: string;
    username_selector?: string;
    password_selector?: string;
    submit_selector?: string;
    post_job_url?: string;
    post_job_flow?: string;
  };
  capabilities?: string[];
  is_active: boolean;
  field_mapping?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  last_synced_at?: string;
}

// ── Constants ─────────────────────────────────────────────────────────

const PORTAL_PRESETS: Record<string, { color: string; login_url: string; api_endpoint: string }> = {
  linkedin:     { color: 'bg-blue-600',    login_url: 'https://www.linkedin.com/login', api_endpoint: 'https://api.linkedin.com/v2/jobs' },
  indeed:       { color: 'bg-blue-600',  login_url: 'https://secure.indeed.com/auth', api_endpoint: 'https://apis.indeed.com/graphql' },
  naukri:       { color: 'bg-sky-600',     login_url: 'https://login.naukri.com',       api_endpoint: 'https://api.naukri.com/v1' },
  glassdoor:    { color: 'bg-emerald-600', login_url: 'https://www.glassdoor.com/profile/login', api_endpoint: 'https://api.glassdoor.com/v1' },
  monster:      { color: 'bg-blue-600',  login_url: 'https://www.monster.com/profile/sign-in', api_endpoint: 'https://api.monster.com/v2' },
  ziprecruiter: { color: 'bg-teal-600',    login_url: 'https://www.ziprecruiter.com/login', api_endpoint: 'https://api.ziprecruiter.com/v2' },
};

const FALLBACK_COLORS = [
  'bg-blue-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-blue-600', 'bg-teal-600',
];

function getPortalPreset(name: string) {
  const lower = name.toLowerCase();
  for (const [key, preset] of Object.entries(PORTAL_PRESETS)) {
    if (lower.includes(key)) return preset;
  }
  return null;
}

function getPortalColor(name: string): string {
  const preset = getPortalPreset(name);
  if (preset) return preset.color;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function getIntegrationIcon(type?: string) {
  switch (type) {
    case 'rss': return <Rss className="h-3 w-3" />;
    case 'web_automation': return <Monitor className="h-3 w-3" />;
    case 'mcp': return <Cable className="h-3 w-3" />;
    case 'manual': return <Hand className="h-3 w-3" />;
    default: return <Zap className="h-3 w-3" />;
  }
}

function getAuthIcon(type?: string) {
  switch (type) {
    case 'oauth2': return <Lock className="h-3 w-3" />;
    case 'basic': return <Shield className="h-3 w-3" />;
    case 'none': return <Unplug className="h-3 w-3" />;
    default: return <KeyRound className="h-3 w-3" />;
  }
}

const INTEGRATION_LABELS: Record<string, string> = {
  api: 'API',
  rss: 'RSS Feed',
  web_automation: 'Web Automation',
  mcp: 'MCP Server',
  manual: 'Manual',
};

const AUTH_LABELS: Record<string, string> = {
  api_key: 'API Key',
  oauth2: 'OAuth 2.0',
  basic: 'Basic Auth',
  none: 'None',
};

const ALL_CAPABILITIES = [
  { value: 'post_job', label: 'Post Jobs', icon: Upload },
  { value: 'search_candidates', label: 'Search Candidates', icon: Download },
  { value: 'sync_applications', label: 'Sync Applications', icon: RefreshCw },
  { value: 'manage_listings', label: 'Manage Listings', icon: Settings2 },
  { value: 'analytics', label: 'View Analytics', icon: Sparkles },
  { value: 'messaging', label: 'Candidate Messaging', icon: Send },
];

// ── Main Component ────────────────────────────────────────────────────

export default function JobPortals() {
  const { toast } = useToast();
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Portal | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);
  const [dialogTab, setDialogTab] = useState('general');

  // ── Form state ────────────────────────────────────────
  const [form, setForm] = useState<Record<string, any>>({
    portal_name: '',
    api_endpoint: '',
    auth_type: 'api_key',
    integration_type: 'api',
    // Credentials
    cred_api_key: '',
    cred_client_id: '',
    cred_client_secret: '',
    cred_username: '',
    cred_password: '',
    cred_token_url: '',
    // MCP
    mcp_server_url: '',
    mcp_transport: 'streamable_http',
    // Web automation
    wa_login_url: '',
    wa_username: '',
    wa_password: '',
    wa_post_job_url: '',
    wa_instructions: '',
    // Capabilities
    capabilities: [] as string[],
  });

  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const loadPortals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getJobPortals();
      setPortals(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load portals', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadPortals(); }, [loadPortals]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      portal_name: '', api_endpoint: '', auth_type: 'api_key', integration_type: 'api',
      cred_api_key: '', cred_client_id: '', cred_client_secret: '', cred_username: '', cred_password: '', cred_token_url: '',
      mcp_server_url: '', mcp_transport: 'streamable_http',
      wa_login_url: '', wa_username: '', wa_password: '', wa_post_job_url: '', wa_instructions: '',
      capabilities: [],
    });
    setDialogTab('general');
    setShowDialog(true);
  };

  const openEdit = (p: Portal) => {
    setEditing(p);
    const creds = p.auth_credentials || {};
    const wac = p.web_automation_config || {};
    setForm({
      portal_name: p.portal_name,
      api_endpoint: p.api_endpoint || '',
      auth_type: p.auth_type || 'api_key',
      integration_type: p.integration_type || 'api',
      cred_api_key: creds.api_key || '',
      cred_client_id: creds.client_id || '',
      cred_client_secret: creds.client_secret || '',
      cred_username: creds.username || '',
      cred_password: creds.password || '',
      cred_token_url: creds.token_url || '',
      mcp_server_url: p.mcp_server_url || '',
      mcp_transport: p.mcp_transport || 'streamable_http',
      wa_login_url: wac.login_url || '',
      wa_username: wac.username || '',
      wa_password: wac.password || '',
      wa_post_job_url: wac.post_job_url || '',
      wa_instructions: wac.post_job_flow || '',
      capabilities: p.capabilities || [],
    });
    setDialogTab('general');
    setShowDialog(true);
  };

  // Auto-fill presets when portal name changes
  const handleNameChange = (name: string) => {
    setForm((f: Record<string, any>) => {
      const updated = { ...f, portal_name: name };
      const preset = getPortalPreset(name);
      if (preset && !f.api_endpoint) {
        updated.api_endpoint = preset.api_endpoint;
        updated.wa_login_url = preset.login_url;
      }
      return updated;
    });
  };

  const buildPayload = () => {
    const payload: Record<string, any> = {
      portal_name: form.portal_name,
      api_endpoint: form.api_endpoint || undefined,
      auth_type: form.auth_type,
      integration_type: form.integration_type,
      capabilities: form.capabilities.length > 0 ? form.capabilities : undefined,
    };

    // Build credentials based on auth type
    const creds: Record<string, string> = {};
    if (form.auth_type === 'api_key' && form.cred_api_key) {
      creds.api_key = form.cred_api_key;
    } else if (form.auth_type === 'oauth2') {
      if (form.cred_client_id) creds.client_id = form.cred_client_id;
      if (form.cred_client_secret) creds.client_secret = form.cred_client_secret;
      if (form.cred_token_url) creds.token_url = form.cred_token_url;
    } else if (form.auth_type === 'basic') {
      if (form.cred_username) creds.username = form.cred_username;
      if (form.cred_password) creds.password = form.cred_password;
    }
    if (Object.keys(creds).length > 0) payload.auth_credentials = creds;

    // MCP config
    if (form.integration_type === 'mcp') {
      payload.mcp_server_url = form.mcp_server_url || undefined;
      payload.mcp_transport = form.mcp_transport || undefined;
    }

    // Web automation config
    if (form.integration_type === 'web_automation') {
      const wac: Record<string, string> = {};
      if (form.wa_login_url) wac.login_url = form.wa_login_url;
      if (form.wa_username) wac.username = form.wa_username;
      if (form.wa_password) wac.password = form.wa_password;
      if (form.wa_post_job_url) wac.post_job_url = form.wa_post_job_url;
      if (form.wa_instructions) wac.post_job_flow = form.wa_instructions;
      if (Object.keys(wac).length > 0) payload.web_automation_config = wac;
    }

    return payload;
  };

  const handleSave = async () => {
    if (!form.portal_name.trim()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await apiClient.updateJobPortal(editing.id, payload);
        toast({ title: 'Updated', description: 'Portal configuration updated' });
      } else {
        await apiClient.addJobPortal(payload);
        toast({ title: 'Created', description: 'Job portal added successfully' });
      }
      setShowDialog(false);
      loadPortals();
    } catch {
      toast({ title: 'Error', description: 'Failed to save portal', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.deleteJobPortal(id);
      toast({ title: 'Deleted', description: 'Portal removed' });
      loadPortals();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete portal', variant: 'destructive' });
    }
  };

  const handleTestConnection = async (id: number) => {
    setTesting(id);
    try {
      const result = await apiClient.testJobPortal(id);
      toast({
        title: result.success ? 'Connection Successful' : 'Connection Failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to test connection', variant: 'destructive' });
    } finally {
      setTesting(null);
    }
  };

  const handleSync = async (id: number, action: string) => {
    try {
      const result = await apiClient.syncJobPortal(id, action);
      toast({ title: 'Action Queued', description: result.message });
    } catch {
      toast({ title: 'Error', description: 'Failed to trigger action', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (portal: Portal) => {
    try {
      await apiClient.updateJobPortal(portal.id, { is_active: !portal.is_active });
      loadPortals();
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle portal status', variant: 'destructive' });
    }
  };

  const activeCount = portals.filter(p => p.is_active).length;
  const mcpCount = portals.filter(p => p.integration_type === 'mcp').length;
  const automationCount = portals.filter(p => p.integration_type === 'web_automation').length;

  const togglePassword = (field: string) => setShowPasswords(s => ({ ...s, [field]: !s[field] }));

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* ── Page Header ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex items-center justify-between"
        >
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Job Portals</h1>
            <p className="text-slate-400 text-sm">
              Connect job boards via API, MCP servers, or web automation — AI agents handle the rest
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
          >
            <Plus className="h-4 w-4" /> Add Portal
          </button>
        </motion.div>

        {/* ── KPI Cards ───────────────────────────────────────────── */}
        <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={scaleIn}>
            <div className="rounded-xl shadow-sm hover:shadow-md transition-shadow" style={glassCard}>
              <div className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-white"><CountingNumber value={portals.length} /></p>
                  <p className="text-xs text-slate-500 font-medium">Total Portals</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={scaleIn}>
            <div className="rounded-xl shadow-sm hover:shadow-md transition-shadow" style={glassCard}>
              <div className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Wifi className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-white"><CountingNumber value={activeCount} /></p>
                  <p className="text-xs text-slate-500 font-medium">Connected</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={scaleIn}>
            <div className="rounded-xl shadow-sm hover:shadow-md transition-shadow" style={glassCard}>
              <div className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  <Cable className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-white"><CountingNumber value={mcpCount} /></p>
                  <p className="text-xs text-slate-500 font-medium">MCP Servers</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={scaleIn}>
            <div className="rounded-xl shadow-sm hover:shadow-md transition-shadow" style={glassCard}>
              <div className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-white"><CountingNumber value={automationCount} /></p>
                  <p className="text-xs text-slate-500 font-medium">Automations</p>
                </div>
              </div>
            </div>
          </motion.div>
        </StaggerGrid>

        {/* ── Section Heading ─────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Configured Integrations</h2>
          <div className="flex-1 border-t" style={{ borderColor: 'var(--orbis-border)' }} />
        </motion.div>

        {/* ── Portals Grid ────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 w-full rounded-xl animate-pulse" style={{ background: 'var(--orbis-card)' }} />
            ))}
          </div>
        ) : portals.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <div className="rounded-xl border-dashed border-2" style={{ borderColor: 'var(--orbis-border)', ...glassCard }}>
              <div className="py-20 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--orbis-input)' }}>
                  <Globe2 className="h-8 w-8 text-slate-500" />
                </div>
                <p className="text-lg font-semibold mb-1.5 text-white">No portals configured</p>
                <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                  Connect job boards like LinkedIn, Indeed, or Naukri via API, MCP servers, or web automation.
                  AI agents will manage postings and sync applications automatically.
                </p>
                <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
                >
                  <Plus className="h-4 w-4" /> Add Your First Portal
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {portals.map((portal) => (
              <motion.div key={portal.id} variants={fadeInUp}>
                <PortalCard
                  portal={portal}
                  onEdit={() => openEdit(portal)}
                  onDelete={() => handleDelete(portal.id)}
                  onTest={() => handleTestConnection(portal.id)}
                  onSync={(action) => handleSync(portal.id, action)}
                  onToggleActive={() => handleToggleActive(portal)}
                  isTesting={testing === portal.id}
                />
              </motion.div>
            ))}
          </StaggerGrid>
        )}
      </div>

      {/* ── Add / Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2 text-white">
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing ? 'Configure Portal' : 'Add Job Portal'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editing
                ? 'Update credentials, MCP connection, or automation settings.'
                : 'Connect a job board via API, MCP server, or web automation for AI-powered job management.'
              }
            </DialogDescription>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={setDialogTab} className="mt-2">
            <TabsList className="grid grid-cols-4 h-9" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }}>
              <TabsTrigger value="general" className="text-xs gap-1.5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
                <Globe2 className="h-3 w-3" /> General
              </TabsTrigger>
              <TabsTrigger value="credentials" className="text-xs gap-1.5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
                <KeyRound className="h-3 w-3" /> Credentials
              </TabsTrigger>
              <TabsTrigger value="mcp" className="text-xs gap-1.5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
                <Cable className="h-3 w-3" /> MCP
              </TabsTrigger>
              <TabsTrigger value="automation" className="text-xs gap-1.5 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
                <Bot className="h-3 w-3" /> Automation
              </TabsTrigger>
            </TabsList>

            {/* ─── General Tab ─── */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Portal Name *</label>
                <input
                  value={form.portal_name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g., LinkedIn, Indeed, Naukri"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                  style={glassInput}
                  onFocus={applyFocus}
                  onBlur={applyBlur}
                />
                {getPortalPreset(form.portal_name) && (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Preset detected — endpoints auto-filled
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">API Endpoint</label>
                <input
                  value={form.api_endpoint}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, api_endpoint: e.target.value }))}
                  placeholder="https://api.example.com/v1/jobs"
                  className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none transition-all"
                  style={glassInput}
                  onFocus={applyFocus}
                  onBlur={applyBlur}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Auth Type</label>
                  <Select value={form.auth_type} onValueChange={v => setForm((f: Record<string, any>) => ({ ...f, auth_type: v }))}>
                    <SelectTrigger className="rounded-lg" style={glassInput}><SelectValue /></SelectTrigger>
                    <SelectContent style={selectDrop}>
                      <SelectItem value="api_key" className="text-slate-200 focus:bg-white/10 focus:text-white">API Key</SelectItem>
                      <SelectItem value="oauth2" className="text-slate-200 focus:bg-white/10 focus:text-white">OAuth 2.0</SelectItem>
                      <SelectItem value="basic" className="text-slate-200 focus:bg-white/10 focus:text-white">Basic Auth</SelectItem>
                      <SelectItem value="none" className="text-slate-200 focus:bg-white/10 focus:text-white">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Integration Type</label>
                  <Select value={form.integration_type} onValueChange={v => setForm((f: Record<string, any>) => ({ ...f, integration_type: v }))}>
                    <SelectTrigger className="rounded-lg" style={glassInput}><SelectValue /></SelectTrigger>
                    <SelectContent style={selectDrop}>
                      <SelectItem value="api" className="text-slate-200 focus:bg-white/10 focus:text-white">API</SelectItem>
                      <SelectItem value="mcp" className="text-slate-200 focus:bg-white/10 focus:text-white">MCP Server</SelectItem>
                      <SelectItem value="web_automation" className="text-slate-200 focus:bg-white/10 focus:text-white">Web Automation</SelectItem>
                      <SelectItem value="rss" className="text-slate-200 focus:bg-white/10 focus:text-white">RSS Feed</SelectItem>
                      <SelectItem value="manual" className="text-slate-200 focus:bg-white/10 focus:text-white">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Capabilities */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Capabilities</label>
                <p className="text-[11px] text-slate-500">Select what this portal supports — AI agents will use these capabilities</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_CAPABILITIES.map(cap => {
                    const Icon = cap.icon;
                    const isSelected = (form.capabilities || []).includes(cap.value);
                    return (
                      <button
                        key={cap.value}
                        type="button"
                        onClick={() => setForm((f: Record<string, any>) => ({
                          ...f,
                          capabilities: isSelected
                            ? f.capabilities.filter((c: string) => c !== cap.value)
                            : [...(f.capabilities || []), cap.value],
                        }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                            : 'border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/[0.03]'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {cap.label}
                        {isSelected && <CheckCircle className="h-3 w-3 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* ─── Credentials Tab ─── */}
            <TabsContent value="credentials" className="space-y-4 mt-4">
              <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  Credentials are stored encrypted. They are used by AI agents to authenticate with the portal.
                </p>
              </div>

              {form.auth_type === 'api_key' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">API Key</label>
                  <div className="relative">
                    <input
                      type={showPasswords.api_key ? 'text' : 'password'}
                      value={form.cred_api_key}
                      onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_api_key: e.target.value }))}
                      placeholder="Enter your API key"
                      className="w-full px-3 py-2 rounded-lg pr-10 font-mono text-sm outline-none transition-all"
                      style={glassInput}
                      onFocus={applyFocus}
                      onBlur={applyBlur}
                    />
                    <button type="button" onClick={() => togglePassword('api_key')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                      {showPasswords.api_key ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {form.auth_type === 'oauth2' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Client ID</label>
                    <input
                      value={form.cred_client_id}
                      onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_client_id: e.target.value }))}
                      placeholder="OAuth Client ID"
                      className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none transition-all"
                      style={glassInput}
                      onFocus={applyFocus}
                      onBlur={applyBlur}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Client Secret</label>
                    <div className="relative">
                      <input
                        type={showPasswords.client_secret ? 'text' : 'password'}
                        value={form.cred_client_secret}
                        onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_client_secret: e.target.value }))}
                        placeholder="OAuth Client Secret"
                        className="w-full px-3 py-2 rounded-lg pr-10 font-mono text-sm outline-none transition-all"
                        style={glassInput}
                        onFocus={applyFocus}
                        onBlur={applyBlur}
                      />
                      <button type="button" onClick={() => togglePassword('client_secret')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        {showPasswords.client_secret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Token URL</label>
                    <input
                      value={form.cred_token_url}
                      onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_token_url: e.target.value }))}
                      placeholder="https://accounts.example.com/oauth2/token"
                      className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none transition-all"
                      style={glassInput}
                      onFocus={applyFocus}
                      onBlur={applyBlur}
                    />
                  </div>
                </>
              )}

              {form.auth_type === 'basic' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Username</label>
                    <input
                      value={form.cred_username}
                      onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_username: e.target.value }))}
                      placeholder="Username"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                      style={glassInput}
                      onFocus={applyFocus}
                      onBlur={applyBlur}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.basic_pass ? 'text' : 'password'}
                        value={form.cred_password}
                        onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_password: e.target.value }))}
                        placeholder="Password"
                        className="w-full px-3 py-2 rounded-lg pr-10 text-sm outline-none transition-all"
                        style={glassInput}
                        onFocus={applyFocus}
                        onBlur={applyBlur}
                      />
                      <button type="button" onClick={() => togglePassword('basic_pass')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        {showPasswords.basic_pass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {form.auth_type === 'none' && (
                <div className="text-center py-6 text-sm text-slate-500">
                  <Unplug className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No credentials needed for this auth type.
                </div>
              )}
            </TabsContent>

            {/* ─── MCP Tab ─── */}
            <TabsContent value="mcp" className="space-y-4 mt-4">
              <div className="rounded-lg p-3" style={{ background: 'rgba(27,142,229,0.06)', border: '1px solid rgba(27,142,229,0.15)' }}>
                <p className="text-xs text-blue-400 flex items-center gap-1.5">
                  <Cable className="h-3.5 w-3.5 shrink-0" />
                  MCP (Model Context Protocol) allows AI agents to directly interact with this portal's tools — post jobs, search candidates, and more.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">MCP Server URL</label>
                <input
                  value={form.mcp_server_url}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, mcp_server_url: e.target.value }))}
                  placeholder="http://localhost:3000/mcp or npx @linkedin/mcp-server"
                  className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none transition-all"
                  style={glassInput}
                  onFocus={applyFocus}
                  onBlur={applyBlur}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Transport</label>
                <Select value={form.mcp_transport} onValueChange={v => setForm((f: Record<string, any>) => ({ ...f, mcp_transport: v }))}>
                  <SelectTrigger className="rounded-lg" style={glassInput}><SelectValue /></SelectTrigger>
                  <SelectContent style={selectDrop}>
                    <SelectItem value="streamable_http" className="text-slate-200 focus:bg-white/10 focus:text-white">Streamable HTTP</SelectItem>
                    <SelectItem value="sse" className="text-slate-200 focus:bg-white/10 focus:text-white">SSE (Server-Sent Events)</SelectItem>
                    <SelectItem value="stdio" className="text-slate-200 focus:bg-white/10 focus:text-white">stdio (Local Process)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* MCP Tools Display */}
              {editing?.mcp_tools && editing.mcp_tools.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Terminal className="h-3 w-3" /> Discovered Tools
                  </label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {editing.mcp_tools.map((tool, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                        <Zap className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium font-mono text-white">{tool.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{tool.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--orbis-card)' }}>
                <p className="text-xs font-semibold text-white">How MCP Integration Works</p>
                <ul className="text-[11px] text-slate-500 space-y-1.5">
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold">1.</span> Portal provides an MCP server endpoint (URL or local command)</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold">2.</span> Our AI agent connects and discovers available tools</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold">3.</span> Agent uses tools to post jobs, fetch applications, search candidates</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 font-bold">4.</span> All actions are logged in your audit trail for compliance</li>
                </ul>
              </div>
            </TabsContent>

            {/* ─── Automation Tab ─── */}
            <TabsContent value="automation" className="space-y-4 mt-4">
              <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 shrink-0" />
                  Web automation lets our AI agent log into the portal with your credentials and perform actions on your behalf — no API needed.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Portal Login URL</label>
                <input
                  value={form.wa_login_url}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, wa_login_url: e.target.value }))}
                  placeholder="https://www.linkedin.com/login"
                  className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none transition-all"
                  style={glassInput}
                  onFocus={applyFocus}
                  onBlur={applyBlur}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Portal Username / Email</label>
                  <input
                    value={form.wa_username}
                    onChange={e => setForm((f: Record<string, any>) => ({ ...f, wa_username: e.target.value }))}
                    placeholder="hr@company.com"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                    style={glassInput}
                    onFocus={applyFocus}
                    onBlur={applyBlur}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Portal Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.wa_password ? 'text' : 'password'}
                      value={form.wa_password}
                      onChange={e => setForm((f: Record<string, any>) => ({ ...f, wa_password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-lg pr-10 text-sm outline-none transition-all"
                      style={glassInput}
                      onFocus={applyFocus}
                      onBlur={applyBlur}
                    />
                    <button type="button" onClick={() => togglePassword('wa_password')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                      {showPasswords.wa_password ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Post Job URL (optional)</label>
                <input
                  value={form.wa_post_job_url}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, wa_post_job_url: e.target.value }))}
                  placeholder="https://www.linkedin.com/talent/post-a-job"
                  className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none transition-all"
                  style={glassInput}
                  onFocus={applyFocus}
                  onBlur={applyBlur}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">AI Instructions (optional)</label>
                <textarea
                  value={form.wa_instructions}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, wa_instructions: e.target.value }))}
                  placeholder="Additional instructions for the AI agent when automating this portal, e.g. 'After logging in, navigate to the recruiter dashboard and click Post a Job...'"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all resize-none"
                  style={glassInput}
                  onFocus={applyFocus}
                  onBlur={applyBlur}
                />
                <p className="text-[11px] text-slate-500">
                  Give the AI agent step-by-step hints if the portal has a non-standard workflow
                </p>
              </div>

              <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--orbis-card)' }}>
                <p className="text-xs font-semibold text-white">How Web Automation Works</p>
                <ul className="text-[11px] text-slate-500 space-y-1.5">
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">1.</span> AI agent opens a secure browser session</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">2.</span> Logs into the portal with your stored credentials</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">3.</span> Navigates to the job posting page and fills in the form</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">4.</span> Submits and captures a confirmation screenshot for your records</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <button
              onClick={() => setShowDialog(false)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-300 rounded-lg transition-all hover:bg-white/5 disabled:opacity-50"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.portal_name.trim() || saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : editing ? 'Update Portal' : 'Add Portal'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ── Portal Card Component ────────────────────────────────────────────

function PortalCard({
  portal, onEdit, onDelete, onTest, onSync, onToggleActive, isTesting,
}: {
  portal: Portal;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onSync: (action: string) => void;
  onToggleActive: () => void;
  isTesting: boolean;
}) {
  const portalColor = getPortalColor(portal.portal_name);
  const capabilities = portal.capabilities || [];
  const hasCreds = portal.has_credentials;
  const hasMcp = !!portal.mcp_server_url;
  const hasAutomation = !!portal.web_automation_config?.login_url;

  return (
    <div className="group rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg" style={{ ...glassCard, borderColor: 'var(--orbis-hover)' }}>
      <div className={`h-1 ${portalColor} w-full`} />

      <div className="p-5 pt-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${portalColor} text-white shadow-sm`}>
              <span className="text-sm font-bold">{portal.portal_name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h4 className="font-semibold text-sm leading-tight text-white">{portal.portal_name}</h4>
              {portal.created_at && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Added {new Date(portal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={portal.is_active}
              onCheckedChange={onToggleActive}
              className="scale-75"
            />
            <span
              className={`inline-flex items-center text-[10px] font-medium rounded-full px-2.5 py-0.5 border ${
                portal.is_active
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-white/[0.03] text-slate-500 border-white/10'
              }`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${portal.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              {portal.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Endpoint / MCP URL */}
        {(portal.api_endpoint || portal.mcp_server_url) && (
          <div className="flex items-center gap-2 text-xs text-slate-400 rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--orbis-card)' }}>
            {portal.mcp_server_url ? <Cable className="h-3 w-3 shrink-0 text-blue-500" /> : <Link2 className="h-3 w-3 shrink-0" />}
            <span className="truncate font-mono text-[11px]">{portal.mcp_server_url || portal.api_endpoint}</span>
          </div>
        )}

        {/* Meta pills */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 rounded-md px-2 py-1" style={{ background: 'var(--orbis-input)' }}>
            {getIntegrationIcon(portal.integration_type)}
            {INTEGRATION_LABELS[portal.integration_type || 'api'] || portal.integration_type}
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 rounded-md px-2 py-1" style={{ background: 'var(--orbis-input)' }}>
            {getAuthIcon(portal.auth_type)}
            {AUTH_LABELS[portal.auth_type || 'api_key'] || portal.auth_type}
          </div>
          {hasCreds && (
            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-1">
              <CheckCircle className="h-3 w-3" /> Credentials
            </div>
          )}
          {hasMcp && (
            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md px-2 py-1">
              <Cable className="h-3 w-3" /> MCP
            </div>
          )}
          {hasAutomation && (
            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1">
              <Bot className="h-3 w-3" /> Automation
            </div>
          )}
        </div>

        {/* Capabilities */}
        {capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {capabilities.map(cap => {
              const capDef = ALL_CAPABILITIES.find(c => c.value === cap);
              return (
                <span key={cap} className="text-[10px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">
                  {capDef?.label || cap}
                </span>
              );
            })}
          </div>
        )}

        {/* Last synced */}
        {portal.last_synced_at && (
          <p className="text-[10px] text-slate-500 mb-3 flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5" />
            Last synced {new Date(portal.last_synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid var(--orbis-border)' }}>
          {/* Primary actions row */}
          <div className="flex items-center gap-2">
            <button
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-300 rounded-lg h-8 transition-all hover:bg-white/5"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onClick={onEdit}
            >
              <Pencil className="h-3 w-3" /> Configure
            </button>
            <button
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-300 rounded-lg h-8 px-3 transition-all hover:bg-white/5 disabled:opacity-50"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onClick={onTest}
              disabled={isTesting}
            >
              {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlugZap className="h-3 w-3" />}
              Test
            </button>
            <button
              className="inline-flex items-center justify-center text-xs rounded-lg h-8 w-8 p-0 text-red-400 transition-all hover:bg-red-500/10 hover:border-red-500/20"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* AI actions row */}
          {portal.is_active && capabilities.length > 0 && (
            <div className="flex items-center gap-1.5">
              {capabilities.includes('post_job') && (
                <button className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-medium h-7 rounded-md text-blue-400 hover:bg-blue-500/10 transition-all" onClick={() => onSync('post_job')}>
                  <Upload className="h-3 w-3" /> Post Job
                </button>
              )}
              {capabilities.includes('sync_applications') && (
                <button className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-medium h-7 rounded-md text-blue-400 hover:bg-blue-500/10 transition-all" onClick={() => onSync('sync_applications')}>
                  <ArrowRightLeft className="h-3 w-3" /> Sync
                </button>
              )}
              {capabilities.includes('search_candidates') && (
                <button className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-medium h-7 rounded-md text-blue-400 hover:bg-blue-500/10 transition-all" onClick={() => onSync('search_candidates')}>
                  <Download className="h-3 w-3" /> Source
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
