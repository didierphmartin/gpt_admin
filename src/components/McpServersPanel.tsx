import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listMcpServers,
  createMcpServer,
  updateMcpServer,
  toggleMcpServer,
  refreshMcpServerTools,
  deleteMcpServer,
  type McpServer,
} from '../api/client';
import { useUsers } from '../hooks/useUsers';
import type { User } from '../types';
import { usePagedSearch, SearchBox, PaginationFooter } from './TableControls';

interface FormState {
  id: number | null;
  name: string;
  url: string;
  description: string;
  user_id: number | null; // null => global
  headersText: string; // JSON text for editing; parsed on submit
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  url: '',
  description: '',
  user_id: null,
  headersText: '',
};

interface FormProps {
  initial: FormState;
  users: User[];
  onSave: (data: FormState) => Promise<{ ok: boolean; message?: string }>;
  onCancel: () => void;
}

function McpServerForm({ initial, users, onSave, onCancel }: FormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = form.id !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) {
      setError('Name and URL are required');
      return;
    }
    // Validate headers JSON here so we fail fast with a clear message
    const raw = form.headersText.trim();
    if (raw !== '') {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setError('Headers must be a JSON object, e.g. {"Authorization":"Bearer ..."}');
          return;
        }
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') {
            setError(`Header "${k}" must be a string`);
            return;
          }
        }
      } catch {
        setError('Headers is not valid JSON');
        return;
      }
    }
    setSaving(true);
    setError(null);
    const res = await onSave(form);
    setSaving(false);
    if (!res.ok) setError(res.message || 'Save failed');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit MCP Server' : 'Add MCP Server'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2">
              {form.user_id === null
                ? 'Global (all users)'
                : `User: ${users.find(u => u.id === form.user_id)?.email ?? `#${form.user_id}`}`}
              {isEdit && (
                <span className="ml-2 text-xs text-gray-500">(scope cannot be changed after creation)</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="e.g., PubMed"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
              placeholder="https://..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Headers <span className="text-gray-400 font-normal">(JSON object, optional)</span>
            </label>
            <textarea
              value={form.headersText}
              onChange={(e) => setForm({ ...form, headersText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono"
              rows={5}
              placeholder={'{\n  "Authorization": "Bearer sk-...",\n  "X-Api-Key": "..."\n}'}
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-1">
              Sent with every request to this MCP server (for API keys, auth tokens, etc.). Leave blank if none are required.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface McpServersPanelProps {
  /** When provided, panel is locked to this user's scope (per-user management). */
  userId?: number;
}

export function McpServersPanel({ userId }: McpServersPanelProps = {}) {
  const { users, fetchUsers } = useUsers();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formInitial, setFormInitial] = useState<FormState>(EMPTY_FORM);
  const isUserLocked = userId !== undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMcpServers(
        isUserLocked ? { scope: 'user', userId } : { scope: 'global' }
      );
      setServers(res.servers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  }, [userId, isUserLocked]);

  useEffect(() => { if (isUserLocked) fetchUsers(); }, [fetchUsers, isUserLocked]);
  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const globals = servers.filter(s => s.is_global);
    const perUser = servers.filter(s => !s.is_global);
    return { globals, perUser };
  }, [servers]);

  const matchServer = useCallback(
    (s: McpServer, q: string) =>
      `${s.name} ${s.url} ${s.description ?? ''} ${s.user_email ?? ''}`.toLowerCase().includes(q),
    [],
  );
  const globalSearch = usePagedSearch(grouped.globals, matchServer);
  const perUserSearch = usePagedSearch(grouped.perUser, matchServer);

  const handleSave = async (data: FormState): Promise<{ ok: boolean; message?: string }> => {
    try {
      const rawHeaders = data.headersText.trim();
      const headers: Record<string, string> | null = rawHeaders
        ? Object.fromEntries(
            Object.entries(JSON.parse(rawHeaders) as Record<string, unknown>)
              .map(([k, v]) => [k, String(v)])
          )
        : null;
      const res = data.id === null
        ? await createMcpServer({
            name: data.name.trim(),
            url: data.url.trim(),
            description: data.description.trim() || undefined,
            user_id: data.user_id,
            headers,
          })
        : await updateMcpServer({
            server_id: data.id,
            name: data.name.trim(),
            url: data.url.trim(),
            description: data.description.trim() || undefined,
            headers,
          });
      setShowForm(false);
      await load();
      if (res.tools_error) {
        alert(`Saved, but tool discovery returned 0 tools:\n\n${res.tools_error}`);
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Save failed' };
    }
  };

  const handleToggle = async (s: McpServer) => {
    try {
      await toggleMcpServer(s.id, !s.enabled);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Toggle failed');
    }
  };

  const handleRefresh = async (s: McpServer) => {
    try {
      const res = await refreshMcpServerTools(s.id);
      if (res.tools_fetched === 0 && res.tools_error) {
        alert(`Refreshed: 0 tools\n\nServer reported:\n${res.tools_error}`);
      } else {
        alert(`Refreshed: ${res.tools_fetched} tools`);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Refresh failed');
    }
  };

  const handleDelete = async (s: McpServer) => {
    if (!confirm(`Delete MCP server "${s.name}"? This cannot be undone.`)) return;
    try {
      await deleteMcpServer(s.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const startAdd = () => {
    setFormInitial({ ...EMPTY_FORM, user_id: isUserLocked ? (userId ?? null) : null });
    setShowForm(true);
  };

  const startEdit = (s: McpServer) => {
    setFormInitial({
      id: s.id,
      name: s.name,
      url: s.url,
      description: s.description || '',
      user_id: s.user_id === null ? null : parseInt(s.user_id, 10),
      headersText: s.headers && Object.keys(s.headers).length > 0
        ? JSON.stringify(s.headers, null, 2)
        : '',
    });
    setShowForm(true);
  };

  const renderRow = (s: McpServer) => (
    <tr key={s.id} className="border-t border-gray-100">
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900">{s.name}</div>
        {s.description && <div className="text-xs text-gray-500">{s.description}</div>}
      </td>
      <td className="px-3 py-2">
        {s.is_global ? (
          <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Global</span>
        ) : (
          <span className="inline-block px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
            {s.user_email || `user #${s.user_id}`}
          </span>
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-gray-700 max-w-xs truncate" title={s.url}>{s.url}</td>
      <td className="px-3 py-2 text-center text-sm text-gray-700">{s.tool_count}</td>
      <td className="px-3 py-2">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={() => handleToggle(s)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </td>
      <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
        <button onClick={() => startEdit(s)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">Edit</button>
        <button onClick={() => handleRefresh(s)} className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded">Refresh tools</button>
        <button onClick={() => handleDelete(s)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">Delete</button>
      </td>
    </tr>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">MCP Servers</h3>
          <p className="text-sm text-gray-500 mt-1">
            {isUserLocked
              ? 'Manage MCP servers that are available only to this user.'
              : 'Global MCP servers (available to all users). Per-user servers are managed from each user\'s settings.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Reload
          </button>
          <button onClick={startAdd} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700">
            + Add MCP Server
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading…</div>
      ) : servers.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">No MCP servers.</div>
      ) : (
        <div className="space-y-6">
          {grouped.globals.length > 0 && (
            <section>
              <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Global ({grouped.globals.length})</h4>
                <SearchBox
                  value={globalSearch.query}
                  onChange={globalSearch.setQuery}
                  placeholder="Search…"
                  className="w-full sm:w-64 flex-shrink-0"
                />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Scope</th>
                        <th className="px-3 py-2 text-left">URL</th>
                        <th className="px-3 py-2 text-center">Tools</th>
                        <th className="px-3 py-2 text-left">Enabled</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalSearch.total === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                            {globalSearch.query ? 'No servers match your search.' : 'No servers.'}
                          </td>
                        </tr>
                      ) : (
                        globalSearch.pageItems.map(renderRow)
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationFooter
                  page={globalSearch.page}
                  totalPages={globalSearch.totalPages}
                  total={globalSearch.total}
                  pageSize={globalSearch.pageSize}
                  setPage={globalSearch.setPage}
                  noun="servers"
                />
              </div>
            </section>
          )}
          {grouped.perUser.length > 0 && (
            <section>
              <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Per-User ({grouped.perUser.length})</h4>
                <SearchBox
                  value={perUserSearch.query}
                  onChange={perUserSearch.setQuery}
                  placeholder="Search…"
                  className="w-full sm:w-64 flex-shrink-0"
                />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">User</th>
                        <th className="px-3 py-2 text-left">URL</th>
                        <th className="px-3 py-2 text-center">Tools</th>
                        <th className="px-3 py-2 text-left">Enabled</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perUserSearch.total === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                            {perUserSearch.query ? 'No servers match your search.' : 'No servers.'}
                          </td>
                        </tr>
                      ) : (
                        perUserSearch.pageItems.map(renderRow)
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationFooter
                  page={perUserSearch.page}
                  totalPages={perUserSearch.totalPages}
                  total={perUserSearch.total}
                  pageSize={perUserSearch.pageSize}
                  setPage={perUserSearch.setPage}
                  noun="servers"
                />
              </div>
            </section>
          )}
        </div>
      )}

      {showForm && (
        <McpServerForm
          initial={formInitial}
          users={users}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
