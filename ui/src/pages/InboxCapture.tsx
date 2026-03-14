import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/utils/api';
import { CountingNumber } from '@/components/ui/counting-number';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import {
  Mail, Inbox, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Clock,
  FileText, Server, Loader2, Eye, Shield, FolderOpen, Globe, Lock,
  MailOpen, Paperclip, ArrowRight, Sparkles,
} from 'lucide-react';

/* ── design-system constants ─────────────────────────────────────── */
const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

interface InboxConfig {
  id: number;
  name: string;
  imap_host: string;
  imap_port: number;
  username: string;
  use_ssl: boolean;
  folder: string;
  is_active: boolean;
  last_scan_at: string | null;
  created_at: string;
}

interface CaptureLog {
  id: number;
  config_id: number;
  from_name: string;
  from_email: string;
  subject: string;
  body_preview: string;
  attachments: { filename: string; path: string; size: number }[];
  status: string;
  candidate_id: number | null;
  processed_at: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string; icon: typeof Clock }> = {
  pending_review: {
    label: 'Pending Review',
    bg: 'rgba(245,158,11,0.12)',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
    icon: Clock,
  },
  accepted: {
    label: 'Accepted',
    bg: 'rgba(16,185,129,0.12)',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    bg: 'rgba(239,68,68,0.12)',
    text: 'text-red-400',
    dot: 'bg-red-500',
    icon: XCircle,
  },
  converted: {
    label: 'Converted',
    bg: 'rgba(59,130,246,0.12)',
    text: 'text-blue-400',
    dot: 'bg-blue-500',
    icon: CheckCircle2,
  },
};

export default function InboxCapture() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [logFilter, setLogFilter] = useState<string>('');
  const [configFilter, setConfigFilter] = useState<number | undefined>();

  // Form state for new config
  const [configForm, setConfigForm] = useState({
    name: '', imap_host: '', imap_port: 993, username: '', password: '', use_ssl: true, folder: 'INBOX',
  });

  // Queries
  const { data: configs = [] } = useQuery<InboxConfig[]>({
    queryKey: ['inbox-configs'],
    queryFn: () => apiClient.getInboxConfigs(),
  });

  const { data: logsData } = useQuery({
    queryKey: ['capture-logs', configFilter, logFilter],
    queryFn: () => apiClient.getCaptureLogs({
      config_id: configFilter,
      status: logFilter || undefined,
      page_size: 50,
    }),
  });
  const logs: CaptureLog[] = logsData?.items || [];
  const totalLogs = logsData?.total || 0;

  // Stats
  const pendingCount = logs.filter(l => l.status === 'pending_review').length;
  const acceptedCount = logs.filter(l => l.status === 'accepted' || l.status === 'converted').length;

  const handleCreateConfig = async () => {
    if (!configForm.name || !configForm.imap_host || !configForm.username || !configForm.password) {
      toast({ title: 'Missing fields', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    try {
      await apiClient.createInboxConfig(configForm);
      toast({ title: 'Config created' });
      setShowAddConfig(false);
      setConfigForm({ name: '', imap_host: '', imap_port: 993, username: '', password: '', use_ssl: true, folder: 'INBOX' });
      queryClient.invalidateQueries({ queryKey: ['inbox-configs'] });
    } catch {
      toast({ title: 'Failed to create config', variant: 'destructive' });
    }
  };

  const handleDeleteConfig = async (id: number) => {
    try {
      await apiClient.deleteInboxConfig(id);
      toast({ title: 'Config deleted' });
      queryClient.invalidateQueries({ queryKey: ['inbox-configs'] });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const handleScan = async (configId: number) => {
    setScanningId(configId);
    try {
      const result = await apiClient.scanInbox(configId);
      toast({
        title: 'Scan complete',
        description: `Found ${result.captured} emails with resumes out of ${result.scanned} scanned`,
      });
      queryClient.invalidateQueries({ queryKey: ['capture-logs'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-configs'] });
    } catch (e: any) {
      toast({ title: 'Scan failed', description: e?.message || 'Check IMAP credentials', variant: 'destructive' });
    } finally {
      setScanningId(null);
    }
  };

  const handleUpdateLogStatus = async (logId: number, status: string) => {
    try {
      await apiClient.updateCaptureLogStatus(logId, status);
      toast({ title: `Marked as ${status}` });
      queryClient.invalidateQueries({ queryKey: ['capture-logs'] });
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <motion.div
        className="space-y-8"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* ── Page Header ─────────────────────────────────────────── */}
        <motion.div variants={fadeInUp} className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Inbox className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Inbox Capture</h1>
                <p className="text-sm text-slate-400">
                  Scan recruiter inboxes for resume emails and candidate leads
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowAddConfig(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-shadow bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500"
          >
            <Plus className="h-4 w-4" />
            Add Inbox
          </button>
        </motion.div>

        {/* ── KPI Cards ───────────────────────────────────────────── */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              label: 'Connected Inboxes',
              value: configs.length,
              icon: Server,
              gradient: 'from-blue-500 to-blue-600',
              iconBg: 'rgba(59,130,246,0.15)',
              textColor: 'text-blue-400',
            },
            {
              label: 'Pending Review',
              value: pendingCount,
              icon: Clock,
              gradient: 'from-amber-500 to-orange-600',
              iconBg: 'rgba(245,158,11,0.15)',
              textColor: 'text-amber-400',
            },
            {
              label: 'Accepted',
              value: acceptedCount,
              icon: CheckCircle2,
              gradient: 'from-emerald-500 to-teal-600',
              iconBg: 'rgba(16,185,129,0.15)',
              textColor: 'text-emerald-400',
            },
          ].map((kpi) => (
            <motion.div key={kpi.label} variants={fadeInUp}>
              <div style={glassCard} className="rounded-xl p-6 hover:border-white/20 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-400">{kpi.label}</p>
                    <p className="text-3xl font-bold tracking-tight text-white">
                      <CountingNumber value={kpi.value} />
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: kpi.iconBg }}>
                    <kpi.icon className={`h-6 w-6 ${kpi.textColor}`} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp}>
          <Tabs defaultValue="configs" className="space-y-6">
            <TabsList style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-hover)' }} className="p-1 rounded-xl h-auto">
              <TabsTrigger value="configs" className="rounded-lg gap-2 text-sm px-4 py-2 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
                <Server className="h-4 w-4" />
                Inbox Configs
              </TabsTrigger>
              <TabsTrigger value="logs" className="rounded-lg gap-2 text-sm px-4 py-2 text-slate-400 data-[state=active]:text-white data-[state=active]:bg-white/10">
                <MailOpen className="h-4 w-4" />
                Captured Emails
                {pendingCount > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-semibold text-white px-1.5">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Configs Tab ─────────────────────────────────────── */}
            <TabsContent value="configs" className="space-y-5 mt-0">
              {configs.length === 0 ? (
                <div style={{ ...glassCard, borderStyle: 'dashed' }} className="rounded-xl py-16 text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(22,118,192,0.15)' }}>
                    <Mail className="h-8 w-8 text-blue-400" />
                  </div>
                  <p className="text-lg font-semibold text-white">No inboxes configured</p>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                    Add an IMAP inbox to start scanning for candidate resumes automatically
                  </p>
                  <button
                    className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 transition-colors"
                    onClick={() => setShowAddConfig(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Inbox
                  </button>
                </div>
              ) : (
                <motion.div
                  className="grid gap-5 md:grid-cols-2"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {configs.map((cfg) => (
                    <motion.div key={cfg.id} variants={fadeInUp}>
                      <div style={glassCard} className="rounded-xl p-6 hover:border-white/20 transition-all duration-300 group">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-3">
                            {/* Config name + status */}
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                                <Mail className="h-5 w-5 text-white" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold text-base text-white truncate">{cfg.name}</h3>
                                <p className="text-sm text-slate-400 truncate">{cfg.username}</p>
                              </div>
                            </div>

                            {/* Connection details */}
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300" style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-hover)' }}>
                                <Globe className="h-3 w-3 text-slate-400" />
                                {cfg.imap_host}:{cfg.imap_port}
                              </span>
                              {cfg.use_ssl && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-400" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                  <Lock className="h-3 w-3" />
                                  SSL
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300" style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-hover)' }}>
                                <FolderOpen className="h-3 w-3 text-slate-400" />
                                {cfg.folder}
                              </span>
                            </div>

                            {/* Last scan timestamp */}
                            {cfg.last_scan_at && (
                              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                Last scan: {new Date(cfg.last_scan_at).toLocaleString()}
                              </p>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-col gap-2 shrink-0">
                            <button
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 shadow-sm transition-colors disabled:opacity-50"
                              onClick={() => handleScan(cfg.id)}
                              disabled={scanningId === cfg.id}
                            >
                              {scanningId === cfg.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              Scan
                            </button>
                            <button
                              className="inline-flex items-center justify-center rounded-lg h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              onClick={() => handleDeleteConfig(cfg.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </TabsContent>

            {/* ── Capture Logs Tab ────────────────────────────────── */}
            <TabsContent value="logs" className="space-y-5 mt-0">
              {/* Filters bar */}
              <div className="flex flex-wrap items-center gap-3">
                <Select value={logFilter} onValueChange={setLogFilter}>
                  <SelectTrigger className="w-48 rounded-lg text-white" style={glassInput}>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent style={selectDrop} className="rounded-xl text-white">
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                  </SelectContent>
                </Select>
                {configs.length > 0 && (
                  <Select value={configFilter ? String(configFilter) : 'all'} onValueChange={(v) => setConfigFilter(v === 'all' ? undefined : Number(v))}>
                    <SelectTrigger className="w-48 rounded-lg text-white" style={glassInput}>
                      <SelectValue placeholder="All inboxes" />
                    </SelectTrigger>
                    <SelectContent style={selectDrop} className="rounded-xl text-white">
                      <SelectItem value="all">All inboxes</SelectItem>
                      {configs.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {totalLogs > 0 && (
                  <span className="text-sm text-slate-400 ml-auto">
                    {totalLogs} email{totalLogs !== 1 ? 's' : ''} captured
                  </span>
                )}
              </div>

              {logs.length === 0 ? (
                <div style={{ ...glassCard, borderStyle: 'dashed' }} className="rounded-xl py-16 text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'var(--orbis-border)' }}>
                    <Inbox className="h-8 w-8 text-slate-500" />
                  </div>
                  <p className="text-lg font-semibold text-white">No captured emails yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Scan an inbox to get started
                  </p>
                </div>
              ) : (
                <div style={glassCard} className="rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                        <TableHead className="font-semibold text-slate-300">From</TableHead>
                        <TableHead className="font-semibold text-slate-300">Subject</TableHead>
                        <TableHead className="font-semibold text-slate-300">Attachments</TableHead>
                        <TableHead className="font-semibold text-slate-300">Status</TableHead>
                        <TableHead className="font-semibold text-slate-300">Date</TableHead>
                        <TableHead className="font-semibold text-slate-300 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log, index) => {
                        const sc = statusConfig[log.status] || statusConfig.pending_review;
                        const StatusIcon = sc.icon;
                        return (
                          <motion.tr
                            key={log.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03, duration: 0.3 }}
                            className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.03] group"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                                  {(log.from_name || log.from_email || '?')[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-white truncate">{log.from_name}</p>
                                  <p className="text-xs text-slate-500 truncate">{log.from_email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-slate-300 max-w-[250px] truncate">{log.subject}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1.5">
                                {(log.attachments || []).map((att, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs text-slate-300 font-normal"
                                    style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-hover)' }}
                                  >
                                    <Paperclip className="h-3 w-3 text-slate-500" />
                                    {att.filename}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${sc.text}`}
                                style={{ background: sc.bg, border: `1px solid ${sc.bg}` }}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                                {sc.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                              {log.created_at ? new Date(log.created_at).toLocaleDateString() : ''}
                            </TableCell>
                            <TableCell className="text-right">
                              {log.status === 'pending_review' && (
                                <div className="flex gap-1 justify-end opacity-70 group-hover:opacity-100 transition-opacity">
                                  <button
                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                                    onClick={() => handleUpdateLogStatus(log.id, 'accepted')}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                    onClick={() => handleUpdateLogStatus(log.id, 'rejected')}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* ── Add Config Dialog ───────────────────────────────────── */}
        <Dialog open={showAddConfig} onOpenChange={setShowAddConfig}>
          <DialogContent className="max-w-lg border-0 rounded-2xl" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg text-white">Add Inbox Configuration</DialogTitle>
                  <DialogDescription className="text-sm text-slate-400">
                    Configure an IMAP inbox to scan for candidate resumes
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Name</label>
                <input
                  placeholder="e.g. Recruiter Gmail"
                  className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500/40"
                  style={glassInput}
                  value={configForm.name}
                  onChange={(e) => setConfigForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">IMAP Host</label>
                  <input
                    placeholder="imap.gmail.com"
                    className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500/40"
                    style={glassInput}
                    value={configForm.imap_host}
                    onChange={(e) => setConfigForm(f => ({ ...f, imap_host: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Port</label>
                  <input
                    type="number"
                    className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500/40"
                    style={glassInput}
                    value={configForm.imap_port}
                    onChange={(e) => setConfigForm(f => ({ ...f, imap_port: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Email / Username</label>
                <input
                  placeholder="recruiter@company.com"
                  className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500/40"
                  style={glassInput}
                  value={configForm.username}
                  onChange={(e) => setConfigForm(f => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Password / App Password</label>
                <input
                  type="password"
                  placeholder="App-specific password"
                  className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500/40"
                  style={glassInput}
                  value={configForm.password}
                  onChange={(e) => setConfigForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Folder</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500/40"
                    style={glassInput}
                    value={configForm.folder}
                    onChange={(e) => setConfigForm(f => ({ ...f, folder: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-3 pt-7">
                  <Switch
                    checked={configForm.use_ssl}
                    onCheckedChange={(v) => setConfigForm(f => ({ ...f, use_ssl: v }))}
                  />
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Use SSL
                  </label>
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--orbis-grid)', border: '1px solid var(--orbis-border)' }}>
                <p className="text-xs text-slate-500 leading-relaxed">
                  For Gmail, use an App Password (Settings &gt; Security &gt; 2-Step Verification &gt; App passwords).
                  IMAP host: imap.gmail.com, port: 993.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <button
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
                style={{ border: '1px solid var(--orbis-border)' }}
                onClick={() => setShowAddConfig(false)}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 transition-colors"
                onClick={handleCreateConfig}
              >
                <Plus className="h-4 w-4" />
                Add Inbox
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
