import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowUpDown, Calendar, X } from 'lucide-react';

/* ─── Date Presets ───────────────────────────────────────────────────── */

export interface DatePreset {
  label: string;
  days: number; // 0 = all time
}

export const DEFAULT_DATE_PRESETS: DatePreset[] = [
  { label: 'All', days: 0 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: '1 Year', days: 365 },
];

/* ─── Sort Option ────────────────────────────────────────────────────── */

export interface SortOption {
  label: string;
  value: string;
}

/* ─── Props ──────────────────────────────────────────────────────────── */

interface ListToolbarProps {
  /** Search */
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Sort */
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  /** Date filter */
  showDateFilter?: boolean;
  datePresets?: DatePreset[];
  dateValue?: number; // days preset
  onDateChange?: (days: number) => void;
  /** Page size */
  showPageSize?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Extra right-aligned content */
  children?: React.ReactNode;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function ListToolbar({
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
  sortOptions,
  sortValue,
  onSortChange,
  showDateFilter = false,
  datePresets = DEFAULT_DATE_PRESETS,
  dateValue = 0,
  onDateChange,
  showPageSize = false,
  pageSize = 10,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  children,
}: ListToolbarProps) {
  // Debounced search
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  const handleSearchInput = (val: string) => {
    setLocalSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange?.(val);
    }, 300);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {/* Search */}
      {onSearchChange && (
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm rounded-lg bg-muted/40 border-border/60"
          />
          {localSearch && (
            <button
              onClick={() => { setLocalSearch(''); onSearchChange(''); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Date Filter Pills */}
      {showDateFilter && onDateChange && (
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground mr-0.5" />
          {datePresets.map(p => (
            <button
              key={p.label}
              onClick={() => onDateChange(p.days)}
              className={`
                px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                ${dateValue === p.days
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-transparent border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }
              `}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Sort */}
      {sortOptions && sortOptions.length > 0 && onSortChange && (
        <Select value={sortValue} onValueChange={onSortChange}>
          <SelectTrigger className="w-[170px] h-9 text-xs rounded-lg bg-muted/40 border-border/60">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Page Size */}
      {showPageSize && onPageSizeChange && (
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-[100px] h-9 text-xs rounded-lg bg-muted/40 border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map(s => (
              <SelectItem key={s} value={String(s)} className="text-xs">
                {s} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Extra content */}
      {children}
    </div>
  );
}
