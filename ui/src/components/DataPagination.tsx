import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface DataPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function DataPagination({ page, totalPages, total, pageSize, onPageChange }: DataPaginationProps) {
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Build page numbers with ellipsis
  const pages: (number | 'ellipsis')[] = [];
  const tp = Math.max(totalPages, 1);
  if (tp <= 7) {
    for (let i = 1; i <= tp; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('ellipsis');
    for (let i = Math.max(2, page - 1); i <= Math.min(tp - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < tp - 2) pages.push('ellipsis');
    pages.push(tp);
  }

  const glassBtn = {
    background: 'var(--orbis-card)',
    border: '1px solid var(--orbis-border)',
  };

  const activeBtn = {
    background: '#1B8EE5',
    border: '1px solid rgba(27,142,229,0.5)',
  };

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-slate-400">
        Showing {start}–{end} of {total}
      </p>
      {tp > 1 && (
        <nav role="navigation" aria-label="pagination" className="flex items-center gap-1">
          {/* Previous */}
          <button
            onClick={() => page > 1 && onPageChange(page - 1)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white transition-colors hover:bg-white/10 ${
              page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
            }`}
            style={glassBtn}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          {/* Page numbers */}
          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e-${i}`} className="flex h-9 w-9 items-center justify-center text-slate-500">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  p === page ? 'text-white shadow-lg shadow-[#1B8EE5]/25' : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                style={p === page ? activeBtn : glassBtn}
              >
                {p}
              </button>
            )
          )}

          {/* Next */}
          <button
            onClick={() => page < tp && onPageChange(page + 1)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white transition-colors hover:bg-white/10 ${
              page >= tp ? 'pointer-events-none opacity-50' : 'cursor-pointer'
            }`}
            style={glassBtn}
            disabled={page >= tp}
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
