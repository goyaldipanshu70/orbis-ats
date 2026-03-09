import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { cn } from '@/lib/utils';

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
  low: 'bg-muted text-foreground border-border',
  normal: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  high: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  urgent: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

const PRIORITY_ICON: Record<Priority, React.ElementType> = {
  low: Info,
  normal: Bell,
  high: AlertTriangle,
  urgent: AlertTriangle,
};

const BORDER_COLOR: Record<Priority, string> = {
  low: 'border-l-gray-400 dark:border-l-gray-500',
  normal: 'border-l-blue-500 dark:border-l-blue-400',
  high: 'border-l-amber-500 dark:border-l-amber-400',
  urgent: 'border-l-red-500 dark:border-l-red-400',
};

const CARD_BG: Record<Priority, string> = {
  low: '',
  normal: '',
  high: '',
  urgent: 'bg-red-50/60 dark:bg-red-950/20',
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
        <Label htmlFor="ann-title" className="text-sm font-medium">Title</Label>
        <Input
          id="ann-title"
          placeholder="e.g. Office Closure on Friday"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          className="h-10"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ann-content" className="text-sm font-medium">Content</Label>
        <Textarea
          id="ann-content"
          placeholder="Write the announcement body..."
          value={formContent}
          onChange={(e) => setFormContent(e.target.value)}
          rows={8}
          className="resize-y min-h-[120px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Priority</Label>
          <Select value={formPriority} onValueChange={(v) => setFormPriority(v as Priority)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'h-2 w-2 rounded-full',
                      p === 'urgent' && 'bg-red-500',
                      p === 'high' && 'bg-amber-500',
                      p === 'normal' && 'bg-blue-500',
                      p === 'low' && 'bg-gray-400',
                    )} />
                    {PRIORITY_LABELS[p]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pin to top</Label>
          <div className="flex items-center gap-3 pt-1.5">
            <Switch checked={formPinned} onCheckedChange={setFormPinned} />
            <span className="text-sm text-muted-foreground">{formPinned ? 'Pinned' : 'Not pinned'}</span>
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
            <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
            <p className="text-sm text-muted-foreground mt-1">Company-wide news and updates</p>
          </div>
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)} size="default" className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              New Announcement
            </Button>
          )}
        </div>

        {/* Search + Filter bar */}
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Priority filter pills */}
            <div className="flex items-center gap-1.5">
              {FILTER_PILLS.map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => { setPriorityFilter(pill.value); setCurrentPage(1); }}
                  className={cn(
                    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                    priorityFilter === pill.value
                      ? 'bg-foreground text-background shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
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
                <SelectTrigger className="h-8 w-[150px] text-xs gap-1.5">
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="priority">By priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-border p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-2/3 bg-muted rounded" />
                    <div className="h-3 w-1/4 bg-muted rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-4/5 bg-muted rounded" />
                  <div className="h-3 w-3/5 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No announcements found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchQuery || priorityFilter !== 'all'
                ? 'Try adjusting your search or filters to find what you are looking for.'
                : 'Create the first announcement to share updates with your team.'}
            </p>
            {canWrite && !searchQuery && priorityFilter === 'all' && (
              <Button onClick={() => setCreateOpen(true)} variant="outline" className="gap-2 mt-4">
                <Plus className="h-4 w-4" />
                Create Announcement
              </Button>
            )}
          </div>
        ) : (
          <>
            <StaggerGrid className="space-y-3">
              {filteredAnnouncements.map((a) => {
                const PriorityIcon = PRIORITY_ICON[a.priority] || Bell;
                const isExpanded = expandedIds.has(a.id);
                const isLongContent = a.content.length > 200;

                return (
                  <motion.div key={a.id} variants={fadeInUp}>
                    <div
                      className={cn(
                        'relative rounded-lg border border-border border-l-4 transition-all duration-200 hover:shadow-md',
                        BORDER_COLOR[a.priority],
                        CARD_BG[a.priority],
                      )}
                    >
                      {/* Pinned indicator */}
                      {a.pinned && (
                        <div className="absolute top-3 right-3">
                          <div className="flex items-center gap-1 text-blue-500">
                            <Pin className="h-4 w-4 fill-current" />
                          </div>
                        </div>
                      )}

                      <div className="p-5">
                        {/* Title row */}
                        <div className="flex items-start gap-3 pr-8">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5 mb-1">
                              <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                                {a.title}
                              </h3>
                              <Badge className={cn('text-[10px] px-2 py-0.5 gap-1 shrink-0', PRIORITY_BADGE[a.priority])}>
                                <PriorityIcon className="h-3 w-3" />
                                {PRIORITY_LABELS[a.priority]}
                              </Badge>
                            </div>

                            {/* Author + Date */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                              <div className="flex items-center gap-1.5">
                                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <span>Admin</span>
                              </div>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{format(new Date(a.created_at), 'MMM d, yyyy h:mm a')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="relative">
                          <p className={cn(
                            'text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed',
                            !isExpanded && isLongContent && 'line-clamp-3',
                          )}>
                            {a.content}
                          </p>
                          {isLongContent && (
                            <button
                              onClick={() => toggleExpand(a.id)}
                              className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
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
                          <div className="flex items-center gap-0.5 mt-4 pt-3 border-t border-border/60">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                'h-8 px-2.5 gap-1.5 text-xs',
                                a.pinned
                                  ? 'text-blue-600 hover:text-blue-700'
                                  : 'text-muted-foreground hover:text-blue-600',
                              )}
                              onClick={() => handleTogglePin(a)}
                            >
                              {a.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                              <span>{a.pinned ? 'Unpin' : 'Pin'}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-muted-foreground hover:text-amber-600 gap-1.5 text-xs"
                              onClick={() => openEdit(a)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-muted-foreground hover:text-red-600 gap-1.5 text-xs"
                              onClick={() => setDeleteTarget(a)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </StaggerGrid>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <DialogHeader>
              <DialogTitle className="text-lg">New Announcement</DialogTitle>
              <DialogDescription>Publish a new company-wide announcement.</DialogDescription>
            </DialogHeader>
            {announcementForm}
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving} className="gap-2">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Publishing...</> : 'Publish'}
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Edit Announcement</DialogTitle>
            <DialogDescription>Update the announcement details.</DialogDescription>
          </DialogHeader>
          {announcementForm}
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { setEditTarget(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving} className="gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
            <DialogDescription>Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} className="gap-2"><Trash2 className="h-4 w-4" />Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
