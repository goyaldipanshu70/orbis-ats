import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';
import {
  Megaphone, Plus, Trash2, Search, Pencil, Loader2, Pin, PinOff, AlertTriangle, Info, Bell,
  ChevronDown, ChevronUp, ArrowUpDown, User,
} from 'lucide-react';
import { format } from 'date-fns';
import { DataPagination } from '@/components/DataPagination';

// ---------------------------------------------------------------------------
// Design system – dark glass tokens
// ---------------------------------------------------------------------------

const glassCard: React.CSSProperties = { background: 'var(--orbis-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--orbis-border)' };
const glassInput: React.CSSProperties = { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' };
const selectDrop: React.CSSProperties = { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border-strong)' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  pinned: boolean;
  created_by?: number;
  created_at: string;
}

type Priority = 'low' | 'normal' | 'high' | 'urgent';
type FilterPriority = 'all' | Priority;
type SortOption = 'newest' | 'oldest' | 'priority';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent'];

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_BADGE: Record<Priority, string> = {
  low: 'bg-white/5 text-slate-400 border border-white/10',
  normal: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  high: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  urgent: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const PRIORITY_ICON: Record<Priority, React.ElementType> = {
  low: Info,
  normal: Bell,
  high: AlertTriangle,
  urgent: AlertTriangle,
};

const BORDER_COLOR: Record<Priority, string> = {
  low: 'border-l-gray-500',
  normal: 'border-l-blue-400',
  high: 'border-l-amber-400',
  urgent: 'border-l-red-400',
};

const CARD_BG: Record<Priority, string> = {
  low: '',
  normal: '',
  high: '',
  urgent: 'bg-red-500/[0.03]',
};

const FILTER_PILLS: { value: FilterPriority; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Announcements() {
  const { isAdmin, isHR } = useAuth();
  const { toast } = useToast();
  const canWrite = isAdmin() || isHR();

  // Data
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState({ total: 0, page: 1, page_size: 20, total_pages: 1 });

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  // Filter & Sort
  const [priorityFilter, setPriorityFilter] = useState<FilterPriority>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  // Expanded cards
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formPriority, setFormPriority] = useState<Priority>('normal');
  const [formPinned, setFormPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  // -----------------------------------------------------------------------
  // Debounce search
  // -----------------------------------------------------------------------

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounce(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const search = searchDebounce.trim() || undefined;
      const data = await apiClient.getAnnouncements(currentPage, 20, search);
      setAnnouncements(data.items);
      setPaginationMeta({ total: data.total, page: data.page, page_size: data.page_size, total_pages: data.total_pages });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to load announcements.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, currentPage, searchDebounce]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Mark announcements as seen for sidebar badge tracking
  useEffect(() => {
    localStorage.setItem('last_seen_announcement_at', new Date().toISOString());
  }, []);

  // -----------------------------------------------------------------------
  // Filtered & sorted
  // -----------------------------------------------------------------------

  const filteredAnnouncements = announcements
    .filter((a) => priorityFilter === 'all' || a.priority === priorityFilter)
    .sort((a, b) => {
      // Pinned always first
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sortOption === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOption === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      // priority
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });

  // -----------------------------------------------------------------------
  // Expand / collapse
  // -----------------------------------------------------------------------

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // Pin toggle
  // -----------------------------------------------------------------------

  const handleTogglePin = async (a: Announcement) => {
    try {
      await apiClient.updateAnnouncement(a.id, { title: a.title, content: a.content, priority: a.priority, pinned: !a.pinned });
      toast({ title: a.pinned ? 'Unpinned' : 'Pinned', description: `"${a.title}" has been ${a.pinned ? 'unpinned' : 'pinned'}.` });
      fetchAnnouncements();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to update pin status.', variant: 'destructive' });
    }
  };

  // -----------------------------------------------------------------------
  // Form helpers
  // -----------------------------------------------------------------------

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormPriority('normal');
    setFormPinned(false);
  };

  const openEdit = (a: Announcement) => {
    setFormTitle(a.title);
    setFormContent(a.content);
    setFormPriority(a.priority);
    setFormPinned(a.pinned);
    setEditTarget(a);
  };

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast({ title: 'Validation', description: 'Title and content are required.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await apiClient.createAnnouncement({ title: formTitle.trim(), content: formContent.trim(), priority: formPriority, pinned: formPinned });
      toast({ title: 'Created', description: 'Announcement published successfully.' });
      setCreateOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to create announcement.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Edit
  // -----------------------------------------------------------------------

  const handleEdit = async () => {
    if (!editTarget || !formTitle.trim() || !formContent.trim()) {
      toast({ title: 'Validation', description: 'Title and content are required.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await apiClient.updateAnnouncement(editTarget.id, { title: formTitle.trim(), content: formContent.trim(), priority: formPriority, pinned: formPinned });
      toast({ title: 'Updated', description: 'Announcement updated successfully.' });
      setEditTarget(null);
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to update announcement.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.deleteAnnouncement(deleteTarget.id);
      toast({ title: 'Deleted', description: `"${deleteTarget.title}" has been removed.` });
      setDeleteTarget(null);
      fetchAnnouncements();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to delete announcement.', variant: 'destructive' });
    }
  };

  // -----------------------------------------------------------------------
  // Form (shared between create & edit)
  // -----------------------------------------------------------------------

  const announcementForm = (
    <div className="space-y-5 py-2">
      <div className="space-y-2">
        <label htmlFor="ann-title" className="text-sm font-medium text-slate-300">Title</label>
        <input
          id="ann-title"
          placeholder="e.g. Office Closure on Friday"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          className="w-full h-10 px-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
          style={glassInput}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(27,142,229,0.5)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; }}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="ann-content" className="text-sm font-medium text-slate-300">Content</label>
        <textarea
          id="ann-content"
          placeholder="Write the announcement body..."
          value={formContent}
          onChange={(e) => setFormContent(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-y min-h-[120px] placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
          style={glassInput}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(27,142,229,0.5)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; }}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Priority</label>
          <Select value={formPriority} onValueChange={(v) => setFormPriority(v as Priority)}>
            <SelectTrigger className="h-10 rounded-xl text-white border-0" style={glassInput}>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-0" style={selectDrop}>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="text-slate-200 focus:bg-white/10 focus:text-white">
                  <div className="flex items-center gap-2">
                    <span className={[
                      'h-2 w-2 rounded-full',
                      p === 'urgent' ? 'bg-red-500' : '',
                      p === 'high' ? 'bg-amber-500' : '',
                      p === 'normal' ? 'bg-blue-500' : '',
                      p === 'low' ? 'bg-gray-400' : '',
                    ].filter(Boolean).join(' ')} />
                    {PRIORITY_LABELS[p]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Pin to top</label>
          <div className="flex items-center gap-3 pt-1.5">
            <Switch checked={formPinned} onCheckedChange={setFormPinned} />
            <span className="text-sm text-slate-400">{formPinned ? 'Pinned' : 'Not pinned'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Announcements</h1>
            <p className="text-sm text-slate-400 mt-1">Company-wide news and updates</p>
          </div>
          {canWrite && (
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            >
              <Plus className="h-4 w-4" />
              New Announcement
            </button>
          )}
        </div>

        {/* Search + Filter bar */}
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-xl text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/40 transition-all"
              style={glassInput}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(27,142,229,0.5)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--orbis-border)'; }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Priority filter pills */}
            <div className="flex items-center gap-1.5">
              {FILTER_PILLS.map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => { setPriorityFilter(pill.value); setCurrentPage(1); }}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
                  style={
                    priorityFilter === pill.value
                      ? { background: 'rgba(27,142,229,0.15)', color: '#4db5f0' }
                      : { background: 'var(--orbis-input)', color: '#94a3b8' }
                  }
                >
                  {pill.value === 'urgent' && <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5" />}
                  {pill.value === 'normal' && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mr-1.5" />}
                  {pill.value === 'low' && <span className="h-1.5 w-1.5 rounded-full bg-gray-400 mr-1.5" />}
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="ml-auto">
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                <SelectTrigger className="h-8 w-[150px] text-xs gap-1.5 rounded-xl text-white border-0" style={glassInput}>
                  <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-0" style={selectDrop}>
                  <SelectItem value="newest" className="text-slate-200 focus:bg-white/10 focus:text-white">Newest first</SelectItem>
                  <SelectItem value="oldest" className="text-slate-200 focus:bg-white/10 focus:text-white">Oldest first</SelectItem>
                  <SelectItem value="priority" className="text-slate-200 focus:bg-white/10 focus:text-white">By priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg p-5" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-2/3 bg-white/10 rounded" />
                    <div className="h-3 w-1/4 bg-white/10 rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-white/10 rounded" />
                  <div className="h-3 w-4/5 bg-white/10 rounded" />
                  <div className="h-3 w-3/5 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full mb-4" style={{ background: 'var(--orbis-input)' }}>
              <Megaphone className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">No announcements found</h3>
            <p className="text-sm text-slate-400 max-w-sm">
              {searchQuery || priorityFilter !== 'all'
                ? 'Try adjusting your search or filters to find what you are looking for.'
                : 'Create the first announcement to share updates with your team.'}
            </p>
            {canWrite && !searchQuery && priorityFilter === 'all' && (
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                <Plus className="h-4 w-4" />
                Create Announcement
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredAnnouncements.map((a) => {
                const PriorityIcon = PRIORITY_ICON[a.priority] || Bell;
                const isExpanded = expandedIds.has(a.id);
                const isLongContent = a.content.length > 200;

                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div
                      className={[
                        'relative rounded-lg border-l-4 transition-all duration-200 hover:shadow-md',
                        BORDER_COLOR[a.priority],
                        CARD_BG[a.priority],
                      ].filter(Boolean).join(' ')}
                      style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                    >
                      {/* Pinned indicator */}
                      {a.pinned && (
                        <div className="absolute top-3 right-3">
                          <div className="flex items-center gap-1 text-blue-400">
                            <Pin className="h-4 w-4 fill-current" />
                          </div>
                        </div>
                      )}

                      <div className="p-5">
                        {/* Title row */}
                        <div className="flex items-start gap-3 pr-8">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5 mb-1">
                              <h3 className="text-lg font-semibold text-white line-clamp-1">
                                {a.title}
                              </h3>
                              <span className={`inline-flex items-center text-[10px] px-2 py-0.5 gap-1 shrink-0 rounded-md ${PRIORITY_BADGE[a.priority]}`}>
                                <PriorityIcon className="h-3 w-3" />
                                {PRIORITY_LABELS[a.priority]}
                              </span>
                            </div>

                            {/* Author + Date */}
                            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                              <div className="flex items-center gap-1.5">
                                <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: 'var(--orbis-input)' }}>
                                  <User className="h-3 w-3 text-slate-500" />
                                </div>
                                <span>Admin</span>
                              </div>
                              <span className="text-slate-400">|</span>
                              <span>{format(new Date(a.created_at), 'MMM d, yyyy h:mm a')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="relative">
                          <p className={[
                            'text-sm text-slate-300 whitespace-pre-wrap leading-relaxed',
                            !isExpanded && isLongContent ? 'line-clamp-3' : '',
                          ].filter(Boolean).join(' ')}>
                            {a.content}
                          </p>
                          {isLongContent && (
                            <button
                              onClick={() => toggleExpand(a.id)}
                              className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              {isExpanded ? (
                                <>Read less <ChevronUp className="h-3 w-3" /></>
                              ) : (
                                <>Read more <ChevronDown className="h-3 w-3" /></>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Footer actions */}
                        {canWrite && (
                          <div className="flex items-center gap-0.5 mt-4 pt-3" style={{ borderTop: '1px solid var(--orbis-border)' }}>
                            <button
                              className={[
                                'inline-flex items-center h-8 px-2.5 gap-1.5 text-xs rounded-md transition-colors',
                                a.pinned
                                  ? 'text-blue-400 hover:text-blue-300'
                                  : 'text-slate-500 hover:text-blue-400',
                              ].join(' ')}
                              onClick={() => handleTogglePin(a)}
                            >
                              {a.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                              <span>{a.pinned ? 'Unpin' : 'Pin'}</span>
                            </button>
                            <button
                              className="inline-flex items-center h-8 px-2.5 text-slate-500 hover:text-amber-400 gap-1.5 text-xs rounded-md transition-colors"
                              onClick={() => openEdit(a)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              className="inline-flex items-center h-8 px-2.5 text-slate-500 hover:text-red-400 gap-1.5 text-xs rounded-md transition-colors"
                              onClick={() => setDeleteTarget(a)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <DataPagination
              page={paginationMeta.page}
              totalPages={paginationMeta.total_pages}
              total={paginationMeta.total}
              pageSize={paginationMeta.page_size}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="border-0 rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <DialogHeader>
              <DialogTitle className="text-lg text-white">New Announcement</DialogTitle>
              <DialogDescription className="text-slate-400">Publish a new company-wide announcement.</DialogDescription>
            </DialogHeader>
            {announcementForm}
            <DialogFooter className="pt-2">
              <button
                onClick={() => setCreateOpen(false)}
                className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
                style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Publishing...</> : 'Publish'}
              </button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); resetForm(); } }}>
        <DialogContent className="border-0 rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-lg text-white">Edit Announcement</DialogTitle>
            <DialogDescription className="text-slate-400">Update the announcement details.</DialogDescription>
          </DialogHeader>
          {announcementForm}
          <DialogFooter className="pt-2">
            <button
              onClick={() => { setEditTarget(null); resetForm(); }}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="border-0 rounded-2xl max-w-sm" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          <DialogHeader>
            <DialogTitle className="text-white">Delete Announcement</DialogTitle>
            <DialogDescription className="text-slate-400">Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteTarget(null)}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
              style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-all"
            >
              <Trash2 className="h-4 w-4" />Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
