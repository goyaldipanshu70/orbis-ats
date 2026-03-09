import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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

const statusConfig: Record<string, { label: string; color: string; dot: string; icon: typeof Clock }> = {
  pending_review: {
    label: 'Pending Review',
    color: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    icon: Clock,
  },
  accepted: {
    label: 'Accepted',
    color: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
    icon: XCircle,
  },
  converted: {
    label: 'Converted',
    color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
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
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Inbox className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Inbox Capture</h1>
                <p className="text-sm text-muted-foreground">
                  Scan recruiter inboxes for resume emails and candidate leads
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => setShowAddConfig(true)}
            className="rounded-xl gap-2 shadow-md hover:shadow-lg transition-shadow"
          >
            <Plus className="h-4 w-4" />
            Add Inbox
          </Button>
        </motion.div>

        {/* ── KPI Cards ───────────────────────────────────────────── */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              label: 'Connected Inboxes',
              value: configs.length,
              icon: Server,
              gradient: 'from-blue-500 to-indigo-600',
              bgLight: 'bg-blue-50 dark:bg-blue-900/20',
              textColor: 'text-blue-600 dark:text-blue-400',
            },
            {
              label: 'Pending Review',
              value: pendingCount,
              icon: Clock,
              gradient: 'from-amber-500 to-orange-600',
              bgLight: 'bg-amber-50 dark:bg-amber-900/20',
              textColor: 'text-amber-600 dark:text-amber-400',
            },
            {
              label: 'Accepted',
              value: acceptedCount,
              icon: CheckCircle2,
              gradient: 'from-emerald-500 to-teal-600',
              bgLight: 'bg-emerald-50 dark:bg-emerald-900/20',
              textColor: 'text-emerald-600 dark:text-emerald-400',
            },
          ].map((kpi, index) => (
            <motion.div key={kpi.label} variants={fadeInUp}>
              <Card className="rounded-xl border-0 shadow-sm hover:shadow-lg transition-all duration-300 bg-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                      <p className="text-3xl font-bold tracking-tight">
                        <CountingNumber value={kpi.value} />
                      </p>
                    </div>
                    <div className={`h-12 w-12 rounded-xl ${kpi.bgLight} flex items-center justify-center`}>
                      <kpi.icon className={`h-6 w-6 ${kpi.textColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <motion.div variants={fadeInUp}>
          <Tabs defaultValue="configs" className="space-y-6">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="configs" className="rounded-lg gap-2 data-[state=active]:shadow-sm">
                <Server className="h-4 w-4" />
                Inbox Configs
              </TabsTrigger>
              <TabsTrigger value="logs" className="rounded-lg gap-2 data-[state=active]:shadow-sm">
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
                <Card className="rounded-xl border-dashed border-2 bg-muted/20">
                  <CardContent className="py-16 text-center">
                    <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center mb-5">
                      <Mail className="h-8 w-8 text-indigo-500" />
                    </div>
                    <p className="text-lg font-semibold">No inboxes configured</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                      Add an IMAP inbox to start scanning for candidate resumes automatically
                    </p>
                    <Button className="mt-6 rounded-xl gap-2" onClick={() => setShowAddConfig(true)}>
                      <Plus className="h-4 w-4" />
                      Add Inbox
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <motion.div
                  className="grid gap-5 md:grid-cols-2"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {configs.map((cfg) => (
                    <motion.div key={cfg.id} variants={fadeInUp}>
                      <Card className="rounded-xl border-0 shadow-sm hover:shadow-lg transition-all duration-300 group">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0 space-y-3">
                              {/* Config name + status */}
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                                  <Mail className="h-5 w-5 text-white" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-base truncate">{cfg.name}</h3>
                                  <p className="text-sm text-muted-foreground truncate">{cfg.username}</p>
                                </div>
                              </div>

                              {/* Connection details */}
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="rounded-lg gap-1.5 text-xs font-medium bg-muted/50">
                                  <Globe className="h-3 w-3" />
                                  {cfg.imap_host}:{cfg.imap_port}
                                </Badge>
                                {cfg.use_ssl && (
                                  <Badge variant="outline" className="rounded-lg gap-1.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                    <Lock className="h-3 w-3" />
                                    SSL
                                  </Badge>
                                )}
                                <Badge variant="outline" className="rounded-lg gap-1.5 text-xs font-medium bg-muted/50">
                                  <FolderOpen className="h-3 w-3" />
                                  {cfg.folder}
                                </Badge>
                              </div>

                              {/* Last scan timestamp */}
                              {cfg.last_scan_at && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <Clock className="h-3 w-3" />
                                  Last scan: {new Date(cfg.last_scan_at).toLocaleString()}
                                </p>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-col gap-2 shrink-0">
                              <Button
                                size="sm"
                                className="rounded-lg gap-1.5 shadow-sm"
                                onClick={() => handleScan(cfg.id)}
                                disabled={scanningId === cfg.id}
                              >
                                {scanningId === cfg.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                                Scan
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-lg text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteConfig(cfg.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
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
                  <SelectTrigger className="w-48 rounded-lg">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                  </SelectContent>
                </Select>
                {configs.length > 0 && (
                  <Select value={configFilter ? String(configFilter) : 'all'} onValueChange={(v) => setConfigFilter(v === 'all' ? undefined : Number(v))}>
                    <SelectTrigger className="w-48 rounded-lg">
                      <SelectValue placeholder="All inboxes" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All inboxes</SelectItem>
                      {configs.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {totalLogs > 0 && (
                  <span className="text-sm text-muted-foreground ml-auto">
                    {totalLogs} email{totalLogs !== 1 ? 's' : ''} captured
                  </span>
                )}
              </div>

              {logs.length === 0 ? (
                <Card className="rounded-xl border-dashed border-2 bg-muted/20">
                  <CardContent className="py-16 text-center">
                    <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mb-5">
                      <Inbox className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-semibold">No captured emails yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Scan an inbox to get started
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-xl border-0 shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-semibold">From</TableHead>
                        <TableHead className="font-semibold">Subject</TableHead>
                        <TableHead className="font-semibold">Attachments</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
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
                            className="border-b transition-colors hover:bg-muted/50 group"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                                  {(log.from_name || log.from_email || '?')[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{log.from_name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{log.from_email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm max-w-[250px] truncate">{log.subject}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1.5">
                                {(log.attachments || []).map((att, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="rounded-lg text-xs gap-1 bg-muted/50 font-normal"
                                  >
                                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                                    {att.filename}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${sc.color} rounded-lg gap-1.5 font-medium`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                                {sc.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {log.created_at ? new Date(log.created_at).toLocaleDateString() : ''}
                            </TableCell>
                            <TableCell className="text-right">
                              {log.status === 'pending_review' && (
                                <div className="flex gap-1 justify-end opacity-70 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                    onClick={() => handleUpdateLogStatus(log.id, 'accepted')}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                    onClick={() => handleUpdateLogStatus(log.id, 'rejected')}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* ── Add Config Dialog ───────────────────────────────────── */}
        <Dialog open={showAddConfig} onOpenChange={setShowAddConfig}>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Add Inbox Configuration</DialogTitle>
                  <DialogDescription className="text-sm">
                    Configure an IMAP inbox to scan for candidate resumes
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Name</Label>
                <Input
                  placeholder="e.g. Recruiter Gmail"
                  className="rounded-lg"
                  value={configForm.name}
                  onChange={(e) => setConfigForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">IMAP Host</Label>
                  <Input
                    placeholder="imap.gmail.com"
                    className="rounded-lg"
                    value={configForm.imap_host}
                    onChange={(e) => setConfigForm(f => ({ ...f, imap_host: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Port</Label>
                  <Input
                    type="number"
                    className="rounded-lg"
                    value={configForm.imap_port}
                    onChange={(e) => setConfigForm(f => ({ ...f, imap_port: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email / Username</Label>
                <Input
                  placeholder="recruiter@company.com"
                  className="rounded-lg"
                  value={configForm.username}
                  onChange={(e) => setConfigForm(f => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Password / App Password</Label>
                <Input
                  type="password"
                  placeholder="App-specific password"
                  className="rounded-lg"
                  value={configForm.password}
                  onChange={(e) => setConfigForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Folder</Label>
                  <Input
                    className="rounded-lg"
                    value={configForm.folder}
                    onChange={(e) => setConfigForm(f => ({ ...f, folder: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-3 pt-7">
                  <Switch
                    checked={configForm.use_ssl}
                    onCheckedChange={(v) => setConfigForm(f => ({ ...f, use_ssl: v }))}
                  />
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Use SSL
                  </Label>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 border border-border/50 p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  For Gmail, use an App Password (Settings &gt; Security &gt; 2-Step Verification &gt; App passwords).
                  IMAP host: imap.gmail.com, port: 993.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button variant="outline" className="rounded-lg" onClick={() => setShowAddConfig(false)}>
                Cancel
              </Button>
              <Button className="rounded-lg gap-2" onClick={handleCreateConfig}>
                <Plus className="h-4 w-4" />
                Add Inbox
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
