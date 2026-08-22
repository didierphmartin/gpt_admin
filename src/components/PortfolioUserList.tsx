import { useEffect, useState } from 'react';
import { listPortfolioUsers, type PortfolioUser, type PortfolioPagination } from '../api/portfolio';

interface Props {
  token: string;
}

const ROLE_STYLES: Record<string, string> = {
  prospect: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  user: 'bg-green-100 text-green-700 border-green-300',
  admin: 'bg-red-100 text-red-700 border-red-300',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-300',
  inactive: 'bg-gray-100 text-gray-700 border-gray-300',
  suspended: 'bg-red-100 text-red-700 border-red-300',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function PortfolioUserList({ token }: Props) {
  const [users, setUsers] = useState<PortfolioUser[]>([]);
  const [pagination, setPagination] = useState<PortfolioPagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPortfolioUsers(token, { page, limit: 20, search: search || undefined })
      .then(data => {
        if (cancelled) return;
        setUsers(data.users);
        setPagination(data.pagination);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load users.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, page, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-800">Users</h2>
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search email or name…"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
          >
            Search
          </button>
        </form>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-700">{error}</div>}

      {loading && users.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No users found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Tokens used</th>
                <th className="text-left px-4 py-2 font-medium">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(u => {
                const roleClass = ROLE_STYLES[u.role] || ROLE_STYLES.user;
                const statusClass = STATUS_STYLES[u.status] || STATUS_STYLES.inactive;
                const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{u.email}</td>
                    <td className="px-4 py-2 text-gray-700">{fullName}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${roleClass}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${statusClass}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {formatNumber(u.token_used)}
                      {u.token_limit > 0 && (
                        <span className="text-gray-400"> / {formatNumber(u.token_limit)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{formatDate(u.last_login)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.total_pages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
          <div>
            Page {pagination.page} of {pagination.total_pages} · {pagination.total} users
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(p => p + 1)}
              disabled={pagination.page >= pagination.total_pages || loading}
              className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
