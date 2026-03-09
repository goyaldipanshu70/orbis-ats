import { useState, useMemo, useCallback } from 'react';

export interface ClientPaginationOptions {
  pageSize?: number;
  initialPage?: number;
}

export interface ClientPaginationResult<T> {
  /** Current page items (sliced from filtered+sorted data) */
  pageItems: T[];
  /** Current page number (1-indexed) */
  page: number;
  /** Total items after filtering */
  total: number;
  /** Items per page */
  pageSize: number;
  /** Total pages */
  totalPages: number;
  /** Go to page */
  setPage: (p: number) => void;
  /** Change page size */
  setPageSize: (s: number) => void;
}

/**
 * Client-side pagination hook.
 * Accepts already-filtered/sorted data and returns a page slice + pagination state.
 */
export function useClientPagination<T>(
  data: T[],
  options: ClientPaginationOptions = {}
): ClientPaginationResult<T> {
  const [page, setPage] = useState(options.initialPage ?? 1);
  const [pageSize, setPageSizeState] = useState(options.pageSize ?? 10);

  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Clamp page to valid range when data changes
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  const handleSetPage = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
  }, [totalPages]);

  const handleSetPageSize = useCallback((s: number) => {
    setPageSizeState(s);
    setPage(1); // reset to first page on size change
  }, []);

  return {
    pageItems,
    page: safePage,
    total,
    pageSize,
    totalPages,
    setPage: handleSetPage,
    setPageSize: handleSetPageSize,
  };
}
