import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
  indeed:       { color: 'bg-indigo-600',  login_url: 'https://secure.indeed.com/auth', api_endpoint: 'https://apis.indeed.com/graphql' },
  naukri:       { color: 'bg-sky-600',     login_url: 'https://login.naukri.com',       api_endpoint: 'https://api.naukri.com/v1' },
  glassdoor:    { color: 'bg-emerald-600', login_url: 'https://www.glassdoor.com/profile/login', api_endpoint: 'https://api.glassdoor.com/v1' },
  monster:      { color: 'bg-purple-600',  login_url: 'https://www.monster.com/profile/sign-in', api_endpoint: 'https://api.monster.com/v2' },
  ziprecruiter: { color: 'bg-teal-600',    login_url: 'https://www.ziprecruiter.com/login', api_endpoint: 'https://api.ziprecruiter.com/v2' },
};

const FALLBACK_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
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
            <h1 className="text-2xl font-bold tracking-tight">Job Portals</h1>
            <p className="text-muted-foreground text-sm">
              Connect job boards via API, MCP servers, or web automation — AI agents handle the rest
            </p>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-lg shadow-sm">
            <Plus className="h-4 w-4" /> Add Portal
          </Button>
        </motion.div>

        {/* ── KPI Cards ───────────────────────────────────────────── */}
        <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={scaleIn}>
            <Card className="rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight"><CountingNumber value={portals.length} /></p>
                  <p className="text-xs text-muted-foreground font-medium">Total Portals</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={scaleIn}>
            <Card className="rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <Wifi className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight"><CountingNumber value={activeCount} /></p>
                  <p className="text-xs text-muted-foreground font-medium">Connected</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={scaleIn}>
            <Card className="rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                  <Cable className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight"><CountingNumber value={mcpCount} /></p>
                  <p className="text-xs text-muted-foreground font-medium">MCP Servers</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={scaleIn}>
            <Card className="rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/80 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight"><CountingNumber value={automationCount} /></p>
                  <p className="text-xs text-muted-foreground font-medium">Automations</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </StaggerGrid>

        {/* ── Section Heading ─────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Configured Integrations</h2>
          <div className="flex-1 border-t border-border/40" />
        </motion.div>

        {/* ── Portals Grid ────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
          </div>
        ) : portals.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <Card className="rounded-xl border-dashed border-2 border-border/60">
              <CardContent className="py-20 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
                  <Globe2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold mb-1.5">No portals configured</p>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Connect job boards like LinkedIn, Indeed, or Naukri via API, MCP servers, or web automation.
                  AI agents will manage postings and sync applications automatically.
                </p>
                <Button onClick={openCreate} className="gap-1.5 rounded-lg">
                  <Plus className="h-4 w-4" /> Add Your First Portal
                </Button>
              </CardContent>
            </Card>
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing ? 'Configure Portal' : 'Add Job Portal'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update credentials, MCP connection, or automation settings.'
                : 'Connect a job board via API, MCP server, or web automation for AI-powered job management.'
              }
            </DialogDescription>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={setDialogTab} className="mt-2">
            <TabsList className="grid grid-cols-4 h-9">
              <TabsTrigger value="general" className="text-xs gap-1.5">
                <Globe2 className="h-3 w-3" /> General
              </TabsTrigger>
              <TabsTrigger value="credentials" className="text-xs gap-1.5">
                <KeyRound className="h-3 w-3" /> Credentials
              </TabsTrigger>
              <TabsTrigger value="mcp" className="text-xs gap-1.5">
                <Cable className="h-3 w-3" /> MCP
              </TabsTrigger>
              <TabsTrigger value="automation" className="text-xs gap-1.5">
                <Bot className="h-3 w-3" /> Automation
              </TabsTrigger>
            </TabsList>

            {/* ─── General Tab ─── */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Portal Name *</Label>
                <Input
                  value={form.portal_name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g., LinkedIn, Indeed, Naukri"
                  className="rounded-lg"
                />
                {getPortalPreset(form.portal_name) && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Preset detected — endpoints auto-filled
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">API Endpoint</Label>
                <Input
                  value={form.api_endpoint}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, api_endpoint: e.target.value }))}
                  placeholder="https://api.example.com/v1/jobs"
                  className="rounded-lg font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Auth Type</Label>
                  <Select value={form.auth_type} onValueChange={v => setForm((f: Record<string, any>) => ({ ...f, auth_type: v }))}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Integration Type</Label>
                  <Select value={form.integration_type} onValueChange={v => setForm((f: Record<string, any>) => ({ ...f, integration_type: v }))}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="mcp">MCP Server</SelectItem>
                      <SelectItem value="web_automation">Web Automation</SelectItem>
                      <SelectItem value="rss">RSS Feed</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Capabilities */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Capabilities</Label>
                <p className="text-[11px] text-muted-foreground">Select what this portal supports — AI agents will use these capabilities</p>
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
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30'
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
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  Credentials are stored encrypted. They are used by AI agents to authenticate with the portal.
                </p>
              </div>

              {form.auth_type === 'api_key' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">API Key</Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.api_key ? 'text' : 'password'}
                      value={form.cred_api_key}
                      onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_api_key: e.target.value }))}
                      placeholder="Enter your API key"
                      className="rounded-lg pr-10 font-mono text-sm"
                    />
                    <button type="button" onClick={() => togglePassword('api_key')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPasswords.api_key ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {form.auth_type === 'oauth2' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Client ID</Label>
                    <Input
                      value={form.cred_client_id}
                      onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_client_id: e.target.value }))}
                      placeholder="OAuth Client ID"
                      className="rounded-lg font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Client Secret</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords.client_secret ? 'text' : 'password'}
                        value={form.cred_client_secret}
                        onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_client_secret: e.target.value }))}
                        placeholder="OAuth Client Secret"
                        className="rounded-lg pr-10 font-mono text-sm"
                      />
                      <button type="button" onClick={() => togglePassword('client_secret')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPasswords.client_secret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Token URL</Label>
                    <Input
                      value={form.cred_token_url}
                      onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_token_url: e.target.value }))}
                      placeholder="https://accounts.example.com/oauth2/token"
                      className="rounded-lg font-mono text-sm"
                    />
                  </div>
                </>
              )}

              {form.auth_type === 'basic' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Username</Label>
                    <Input
                      value={form.cred_username}
                      onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_username: e.target.value }))}
                      placeholder="Username"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords.basic_pass ? 'text' : 'password'}
                        value={form.cred_password}
                        onChange={e => setForm((f: Record<string, any>) => ({ ...f, cred_password: e.target.value }))}
                        placeholder="Password"
                        className="rounded-lg pr-10"
                      />
                      <button type="button" onClick={() => togglePassword('basic_pass')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPasswords.basic_pass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {form.auth_type === 'none' && (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Unplug className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No credentials needed for this auth type.
                </div>
              )}
            </TabsContent>

            {/* ─── MCP Tab ─── */}
            <TabsContent value="mcp" className="space-y-4 mt-4">
              <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                <p className="text-xs text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                  <Cable className="h-3.5 w-3.5 shrink-0" />
                  MCP (Model Context Protocol) allows AI agents to directly interact with this portal's tools — post jobs, search candidates, and more.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">MCP Server URL</Label>
                <Input
                  value={form.mcp_server_url}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, mcp_server_url: e.target.value }))}
                  placeholder="http://localhost:3000/mcp or npx @linkedin/mcp-server"
                  className="rounded-lg font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Transport</Label>
                <Select value={form.mcp_transport} onValueChange={v => setForm((f: Record<string, any>) => ({ ...f, mcp_transport: v }))}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="streamable_http">Streamable HTTP</SelectItem>
                    <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
                    <SelectItem value="stdio">stdio (Local Process)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* MCP Tools Display */}
              {editing?.mcp_tools && editing.mcp_tools.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Terminal className="h-3 w-3" /> Discovered Tools
                  </Label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {editing.mcp_tools.map((tool, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                        <Zap className="h-3 w-3 mt-0.5 text-violet-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium font-mono">{tool.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{tool.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">How MCP Integration Works</p>
                <ul className="text-[11px] text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2"><span className="text-violet-500 font-bold">1.</span> Portal provides an MCP server endpoint (URL or local command)</li>
                  <li className="flex items-start gap-2"><span className="text-violet-500 font-bold">2.</span> Our AI agent connects and discovers available tools</li>
                  <li className="flex items-start gap-2"><span className="text-violet-500 font-bold">3.</span> Agent uses tools to post jobs, fetch applications, search candidates</li>
                  <li className="flex items-start gap-2"><span className="text-violet-500 font-bold">4.</span> All actions are logged in your audit trail for compliance</li>
                </ul>
              </div>
            </TabsContent>

            {/* ─── Automation Tab ─── */}
            <TabsContent value="automation" className="space-y-4 mt-4">
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 shrink-0" />
                  Web automation lets our AI agent log into the portal with your credentials and perform actions on your behalf — no API needed.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Portal Login URL</Label>
                <Input
                  value={form.wa_login_url}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, wa_login_url: e.target.value }))}
                  placeholder="https://www.linkedin.com/login"
                  className="rounded-lg font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Portal Username / Email</Label>
                  <Input
                    value={form.wa_username}
                    onChange={e => setForm((f: Record<string, any>) => ({ ...f, wa_username: e.target.value }))}
                    placeholder="hr@company.com"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Portal Password</Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.wa_password ? 'text' : 'password'}
                      value={form.wa_password}
                      onChange={e => setForm((f: Record<string, any>) => ({ ...f, wa_password: e.target.value }))}
                      placeholder="••••••••"
                      className="rounded-lg pr-10"
                    />
                    <button type="button" onClick={() => togglePassword('wa_password')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPasswords.wa_password ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Post Job URL (optional)</Label>
                <Input
                  value={form.wa_post_job_url}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, wa_post_job_url: e.target.value }))}
                  placeholder="https://www.linkedin.com/talent/post-a-job"
                  className="rounded-lg font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">AI Instructions (optional)</Label>
                <Textarea
                  value={form.wa_instructions}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, wa_instructions: e.target.value }))}
                  placeholder="Additional instructions for the AI agent when automating this portal, e.g. 'After logging in, navigate to the recruiter dashboard and click Post a Job...'"
                  rows={3}
                  className="rounded-lg text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Give the AI agent step-by-step hints if the portal has a non-standard workflow
                </p>
              </div>

              <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">How Web Automation Works</p>
                <ul className="text-[11px] text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">1.</span> AI agent opens a secure browser session</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">2.</span> Logs into the portal with your stored credentials</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">3.</span> Navigates to the job posting page and fills in the form</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">4.</span> Submits and captures a confirmation screenshot for your records</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving} className="rounded-lg">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.portal_name.trim() || saving} className="rounded-lg gap-1.5">
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : editing ? 'Update Portal' : 'Add Portal'}
            </Button>
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
    <Card className="group rounded-xl border border-border/60 hover:border-border hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className={`h-1 ${portalColor} w-full`} />

      <CardContent className="p-5 pt-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${portalColor} text-white shadow-sm`}>
              <span className="text-sm font-bold">{portal.portal_name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h4 className="font-semibold text-sm leading-tight">{portal.portal_name}</h4>
              {portal.created_at && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
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
            <Badge
              variant="outline"
              className={`text-[10px] font-medium rounded-full px-2.5 py-0.5 ${
                portal.is_active
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${portal.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              {portal.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {/* Endpoint / MCP URL */}
        {(portal.api_endpoint || portal.mcp_server_url) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 mb-3">
            {portal.mcp_server_url ? <Cable className="h-3 w-3 shrink-0 text-violet-500" /> : <Link2 className="h-3 w-3 shrink-0" />}
            <span className="truncate font-mono text-[11px]">{portal.mcp_server_url || portal.api_endpoint}</span>
          </div>
        )}

        {/* Meta pills */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
            {getIntegrationIcon(portal.integration_type)}
            {INTEGRATION_LABELS[portal.integration_type || 'api'] || portal.integration_type}
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
            {getAuthIcon(portal.auth_type)}
            {AUTH_LABELS[portal.auth_type || 'api_key'] || portal.auth_type}
          </div>
          {hasCreds && (
            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md px-2 py-1">
              <CheckCircle className="h-3 w-3" /> Credentials
            </div>
          )}
          {hasMcp && (
            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 rounded-md px-2 py-1">
              <Cable className="h-3 w-3" /> MCP
            </div>
          )}
          {hasAutomation && (
            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-md px-2 py-1">
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
                <span key={cap} className="text-[10px] font-medium text-primary bg-primary/5 border border-primary/20 rounded px-1.5 py-0.5">
                  {capDef?.label || cap}
                </span>
              );
            })}
          </div>
        )}

        {/* Last synced */}
        {portal.last_synced_at && (
          <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5" />
            Last synced {new Date(portal.last_synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-3 border-t border-border/40">
          {/* Primary actions row */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs rounded-lg h-8 gap-1.5"
              onClick={onEdit}
            >
              <Pencil className="h-3 w-3" /> Configure
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-lg h-8 gap-1.5"
              onClick={onTest}
              disabled={isTesting}
            >
              {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlugZap className="h-3 w-3" />}
              Test
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-lg h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 dark:hover:border-red-800"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* AI actions row */}
          {portal.is_active && capabilities.length > 0 && (
            <div className="flex items-center gap-1.5">
              {capabilities.includes('post_job') && (
                <Button variant="ghost" size="sm" className="flex-1 text-[11px] h-7 rounded-md gap-1 text-primary hover:text-primary hover:bg-primary/5" onClick={() => onSync('post_job')}>
                  <Upload className="h-3 w-3" /> Post Job
                </Button>
              )}
              {capabilities.includes('sync_applications') && (
                <Button variant="ghost" size="sm" className="flex-1 text-[11px] h-7 rounded-md gap-1 text-primary hover:text-primary hover:bg-primary/5" onClick={() => onSync('sync_applications')}>
                  <ArrowRightLeft className="h-3 w-3" /> Sync
                </Button>
              )}
              {capabilities.includes('search_candidates') && (
                <Button variant="ghost" size="sm" className="flex-1 text-[11px] h-7 rounded-md gap-1 text-primary hover:text-primary hover:bg-primary/5" onClick={() => onSync('search_candidates')}>
                  <Download className="h-3 w-3" /> Source
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
