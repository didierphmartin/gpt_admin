import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';

interface Props {
  userId: number;
}

interface KeyState {
  prefix: string | null;
  createdAt: string | null;
}

/**
 * Per-user App Key panel.
 *
 * Manages the simple per-user app key that lives on `users.app_key_hash`.
 * One key per user, no scopes — it authenticates exactly like a JWT.
 * Replaces the earlier scoped-key UI; the underlying `app_keys` table
 * still exists but is dormant.
 */
export function UserAppKeysPanel({ userId }: Props) {
    const [state, setState]               = useState<KeyState | null>(null);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState<string | null>(null);
    const [busy, setBusy]                 = useState(false);
    const [revealedKey, setRevealedKey]   = useState<string | null>(null);
    const [copied, setCopied]             = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = (await api.getUser(userId)) as { success: boolean; user: any };
            const u = result.user || {};
            setState({ prefix: u.app_key_prefix ?? null, createdAt: u.app_key_created_at ?? null });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load user.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { void refresh(); }, [refresh]);

    const handleGenerate = async () => {
        if (state?.prefix && !confirm('Regenerating will invalidate the existing app key. Continue?')) return;
        setBusy(true); setError(null); setRevealedKey(null); setCopied(false);
        try {
            const result = await api.generateUserAppKey(userId);
            setRevealedKey(result.data.app_key);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate app key.');
        } finally {
            setBusy(false);
        }
    };

    const handleRevoke = async () => {
        if (!confirm("Revoke this user's app key? Any client using it will lose access.")) return;
        setBusy(true); setError(null); setRevealedKey(null);
        try {
            await api.revokeUserAppKey(userId);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to revoke app key.');
        } finally {
            setBusy(false);
        }
    };

    const handleCopy = async () => {
        if (!revealedKey) return;
        try {
            await navigator.clipboard.writeText(revealedKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fall back: user selects the input
        }
    };

    const formatDate = (d: string | null): string => {
        if (!d) return '—';
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? d : dt.toLocaleString();
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">App Key</h3>
                <p className="text-sm text-gray-600 mt-1">
                    A single per-user credential that authenticates against the backend API as this user
                    — same access as their login token. Send as{' '}
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Authorization: Bearer uak_…</code>.
                    The full key is shown only once at generation.
                </p>
            </div>

            {loading && <p className="text-sm text-gray-500">Loading…</p>}

            {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
            )}

            {!loading && state && (
                <>
                    {state.prefix ? (
                        <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm text-gray-700 space-y-1">
                            <div>
                                Key: <span className="font-mono">{state.prefix}</span>
                                <span className="text-gray-400">…</span>
                            </div>
                            <div>Created: {formatDate(state.createdAt)}</div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm text-gray-600">
                            No app key for this user yet.
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void handleGenerate()}
                            disabled={busy}
                            className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {state.prefix ? 'Regenerate key' : 'Generate key'}
                        </button>
                        {state.prefix && (
                            <button
                                type="button"
                                onClick={() => void handleRevoke()}
                                disabled={busy}
                                className="px-3 py-2 bg-white border border-gray-300 text-red-600 text-sm rounded hover:bg-red-50 disabled:opacity-50"
                            >
                                Revoke
                            </button>
                        )}
                    </div>

                    {revealedKey && (
                        <div className="bg-amber-50 border border-amber-300 rounded p-4 space-y-2">
                            <p className="text-sm font-semibold text-amber-900">
                                Save this key now. It will not be shown again.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={revealedKey}
                                    onFocus={(e) => e.currentTarget.select()}
                                    className="flex-1 px-2 py-1.5 border border-amber-300 rounded text-xs font-mono bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => void handleCopy()}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 whitespace-nowrap"
                                >
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRevealedKey(null)}
                                className="text-xs text-amber-800 hover:underline"
                            >
                                I've saved it — hide
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
