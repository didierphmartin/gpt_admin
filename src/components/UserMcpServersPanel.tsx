import { useCallback, useEffect, useState } from 'react';
import {
    listUserMcpServers,
    setUserMcpOverride,
    clearUserMcpOverride,
    type EffectiveMcpServer,
} from '../api/client';
import { usePagedSearch, SearchBox, PaginationFooter } from './TableControls';

interface Props {
    userId: number;
}

// Per-user MCP server panel. Subtractive-only model: the package defines what
// the role can see; admin can only DISABLE further (not enable beyond the
// package). Toggling OFF writes an override row with allowed=false; toggling
// back ON deletes the override and the user reverts to the package default.
// Servers the package doesn't allow are shown but their toggle is disabled —
// to enable them, edit the package, not the per-user override.

export function UserMcpServersPanel({ userId }: Props) {
    const [servers, setServers] = useState<EffectiveMcpServer[]>([]);
    const [packageAllowlist, setPackageAllowlist] = useState<string[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyServerId, setBusyServerId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listUserMcpServers(userId);
            setServers(data.servers);
            setPackageAllowlist(data.package_allowlist);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load MCP servers');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    const handleToggle = async (server: EffectiveMcpServer, nextEnabled: boolean) => {
        // Toggling back to the package default state clears the override row;
        // toggling away from it writes one. This keeps the override table
        // sparse — a server matching its package default has no row.
        setBusyServerId(server.id);
        try {
            if (nextEnabled === server.package_default) {
                await clearUserMcpOverride(userId, server.id);
            } else {
                await setUserMcpOverride(userId, server.id, nextEnabled);
            }
            await load();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Update failed');
        } finally {
            setBusyServerId(null);
        }
    };

    const search = usePagedSearch(servers, (s, q) =>
        `${s.name} ${s.description ?? ''}`.toLowerCase().includes(q));

    if (loading && servers.length === 0) {
        return <div className="text-gray-500 text-sm">Loading MCP servers…</div>;
    }
    if (error) {
        return <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">MCP Servers</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        The user's role package defines what's allowed by default. Override per-server
                        below to grant or deny access just for this user.
                    </p>
                </div>
                <button
                    onClick={load}
                    className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 shrink-0"
                >
                    Reload
                </button>
            </div>

            <div className="text-xs text-gray-500">
                Package allowlist:{' '}
                {packageAllowlist === null ? (
                    <span className="text-green-700 font-medium">unrestricted (all servers allowed)</span>
                ) : packageAllowlist.length === 0 ? (
                    <span className="text-red-700 font-medium">empty (none allowed by default)</span>
                ) : (
                    <span className="font-mono">{packageAllowlist.join(', ')}</span>
                )}
            </div>

            {servers.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">No MCP servers configured.</div>
            ) : (
                <>
                <div className="flex justify-end">
                    <SearchBox
                        value={search.query}
                        onChange={search.setQuery}
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
                                <th className="px-3 py-2 text-center">Functions</th>
                                <th className="px-3 py-2 text-left">Available to user</th>
                                <th className="px-3 py-2 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {search.total === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                                        {search.query ? 'No servers match your search.' : 'No MCP servers configured.'}
                                    </td>
                                </tr>
                            ) : search.pageItems.map((s) => {
                                const inPackage = s.package_default;
                                const isBusy = busyServerId === s.id;
                                const switchDisabled = !inPackage || isBusy;
                                return (
                                    <tr
                                        key={s.id}
                                        className={`border-t border-gray-100 ${!inPackage ? 'bg-gray-50' : ''}`}
                                    >
                                        <td className="px-3 py-2">
                                            <div className={`font-medium ${inPackage ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {s.name}
                                            </div>
                                            {s.description && (
                                                <div className={`text-xs ${inPackage ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {s.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {s.is_global ? (
                                                <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                                    Global
                                                </span>
                                            ) : (
                                                <span className="inline-block px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                                                    User-private
                                                </span>
                                            )}
                                        </td>
                                        <td className={`px-3 py-2 text-center ${inPackage ? 'text-gray-700' : 'text-gray-400'}`}>
                                            {s.tool_count}
                                        </td>
                                        <td className="px-3 py-2">
                                            <label className={`relative inline-flex items-center ${switchDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={s.effective}
                                                    disabled={switchDisabled}
                                                    onChange={(e) => handleToggle(s, e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-disabled:opacity-50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
                                            </label>
                                        </td>
                                        <td className="px-3 py-2 text-xs">
                                            {!inPackage ? (
                                                <span className="text-gray-500">
                                                    Disabled by package — edit the role's package to enable.
                                                </span>
                                            ) : s.override === false ? (
                                                <span className="text-amber-700">Overridden off for this user</span>
                                            ) : s.override === true ? (
                                                <span className="text-amber-700">Override forces on (legacy)</span>
                                            ) : (
                                                <span className="text-gray-500">Package default</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                    <PaginationFooter
                        page={search.page}
                        totalPages={search.totalPages}
                        total={search.total}
                        pageSize={search.pageSize}
                        setPage={search.setPage}
                        noun="servers"
                    />
                </div>
                </>
            )}
        </div>
    );
}
