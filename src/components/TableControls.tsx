import { useMemo, useState } from 'react';

/** Shared table style tokens so every list table looks identical. */
export const TH_L = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider';
export const TH_R = 'px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider';
export const TH_C = 'px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider';

/**
 * usePagedSearch — client-side search + pagination for any list table.
 * Pass the rows and a matcher; get back the current page slice plus the
 * state the SearchBox / PaginationFooter need. Keeps all list tables uniform.
 */
export function usePagedSearch<T>(
  items: T[],
  matches: (item: T, query: string) => boolean,
  pageSize = 10,
) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter(item => matches(item, q)) : items),
    [items, q, matches],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const onQueryChange = (value: string) => { setQuery(value); setPage(1); };

  return {
    query, setQuery: onQueryChange,
    page: pageSafe, setPage,
    pageItems, filtered,
    total: filtered.length, totalPages, pageSize,
  };
}

export function SearchBox({
  value, onChange, placeholder = 'Search by email or name...', className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${className}`}
    />
  );
}

export function PaginationFooter({
  page, totalPages, total, pageSize, setPage, noun = 'rows',
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  setPage: (updater: number | ((p: number) => number)) => void;
  noun?: string;
}) {
  const btn =
    'px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
  return (
    <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
      <div className="text-sm text-gray-600">
        {total > 0
          ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total} ${noun}`
          : `No ${noun}`}
      </div>
      {totalPages > 1 && (
        <div className="flex gap-1">
          <button onClick={() => setPage(1)} disabled={page === 1} className={btn}>First</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className={btn}>Prev</button>
          <span className="px-3 py-1 text-sm">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={btn}>Next</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className={btn}>Last</button>
        </div>
      )}
    </div>
  );
}
