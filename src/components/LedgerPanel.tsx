import { useEffect, useState } from 'react';
import {
    listAccounts,
    listTransactions,
    getTransactionStatistics,
    type LedgerAccount,
    type LedgerTransaction,
    type LedgerPagination,
    type LedgerStatistics,
    type ListAccountsParams,
    type ListLedgerTransactionsParams,
} from '../api/ledger';

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    completed: 'bg-green-100 text-green-700 border-green-300',
    failed: 'bg-red-100 text-red-700 border-red-300',
    reversed: 'bg-gray-100 text-gray-700 border-gray-300',
};

const ACCOUNT_STATUS_STYLES: Record<string, string> = {
    active: 'bg-green-100 text-green-700 border-green-300',
    suspended: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    closed: 'bg-red-100 text-red-700 border-red-300',
};

function formatDate(value: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

function formatAmount(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: currency === 'USD' || currency === 'EUR' ? 2 : 8,
    });
    return `${formatter.format(amount)} ${currency}`;
}

export function LedgerPanel() {
    const [selected, setSelected] = useState<LedgerAccount | null>(null);

    return selected ? (
        <AccountDetail account={selected} onBack={() => setSelected(null)} />
    ) : (
        <AccountList onSelect={setSelected} />
    );
}

function AccountList({ onSelect }: { onSelect: (a: LedgerAccount) => void }) {
    const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
    const [pagination, setPagination] = useState<LedgerPagination | null>(null);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [filters, setFilters] = useState<ListAccountsParams>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        listAccounts({ ...filters, page, limit: 50 })
            .then((data) => {
                if (cancelled) return;
                setAccounts(data.accounts);
                setPagination(data.pagination);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load accounts.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [page, filters]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setFilters((f) => ({ ...f, search: searchInput.trim() || undefined }));
    };

    const handleFilterChange = (next: Partial<ListAccountsParams>) => {
        setPage(1);
        setFilters((f) => ({ ...f, ...next }));
    };

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1">Ledger accounts</h2>
                <p className="text-sm text-gray-500">
                    All ledger accounts across applications. Click a row to see the transaction history and balances.
                </p>
            </div>

            <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-64">
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Search</label>
                    <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Email, city, state, postal code…"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <FilterSelect
                    label="Application"
                    value={filters.application || ''}
                    options={['', 'SynergyAiChat', 'PortfolioManagement']}
                    onChange={(v) => handleFilterChange({ application: (v || undefined) as ListAccountsParams['application'] })}
                />
                <FilterSelect
                    label="Status"
                    value={filters.status || ''}
                    options={['', 'active', 'suspended', 'closed']}
                    onChange={(v) => handleFilterChange({ status: (v || undefined) as LedgerAccount['status'] | undefined })}
                />
                <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Search
                </button>
            </form>

            {error && <div className="p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}

            <div className="bg-white rounded-lg border border-gray-200">
                {loading && accounts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Loading accounts…</div>
                ) : accounts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No accounts found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-left px-4 py-2 font-medium">Email</th>
                                    <th className="text-left px-4 py-2 font-medium">Application</th>
                                    <th className="text-right px-4 py-2 font-medium">Cash</th>
                                    <th className="text-right px-4 py-2 font-medium">Credit</th>
                                    <th className="text-right px-4 py-2 font-medium">Crypto</th>
                                    <th className="text-left px-4 py-2 font-medium">Status</th>
                                    <th className="text-left px-4 py-2 font-medium">Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {accounts.map((a) => {
                                    const statusClass = ACCOUNT_STATUS_STYLES[a.status] || ACCOUNT_STATUS_STYLES.active;
                                    return (
                                        <tr
                                            key={a.user_id}
                                            onClick={() => onSelect(a)}
                                            className="hover:bg-blue-50 cursor-pointer"
                                        >
                                            <td className="px-4 py-2 text-gray-900">{a.email}</td>
                                            <td className="px-4 py-2 text-gray-700">{a.application}</td>
                                            <td className="px-4 py-2 text-right text-gray-700">{a.balance_cash}</td>
                                            <td className="px-4 py-2 text-right text-gray-700">{a.balance_credit}</td>
                                            <td className="px-4 py-2 text-right text-gray-700">{a.balance_crypto}</td>
                                            <td className="px-4 py-2">
                                                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${statusClass}`}>
                                                    {a.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-gray-700">{formatDate(a.created_at)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {pagination && pagination.pages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                        <div>
                            Page {pagination.page} of {pagination.pages} · {pagination.total} accounts
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1 || loading}
                                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page >= pagination.pages || loading}
                                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AccountDetail({ account, onBack }: { account: LedgerAccount; onBack: () => void }) {
    const [stats, setStats] = useState<LedgerStatistics | null>(null);
    const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
    const [pagination, setPagination] = useState<LedgerPagination | null>(null);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<ListLedgerTransactionsParams>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        Promise.all([
            listTransactions(account.user_id, { ...filters, page, limit: 50 }),
            getTransactionStatistics(account.user_id).catch(() => null),
        ])
            .then(([tx, st]) => {
                if (cancelled) return;
                setTransactions(tx.transactions);
                setPagination(tx.pagination);
                setStats(st);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load transactions.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [account.user_id, page, filters]);

    const handleFilterChange = (next: Partial<ListLedgerTransactionsParams>) => {
        setPage(1);
        setFilters((f) => ({ ...f, ...next }));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    ← Accounts
                </button>
                <h2 className="text-lg font-semibold text-gray-800">{account.email}</h2>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <div className="text-xs text-gray-500 font-mono">{account.user_id}</div>
                        <div className="text-xs text-gray-500 mt-0.5">App: {account.application}</div>
                    </div>
                    <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${
                            ACCOUNT_STATUS_STYLES[account.status] || ACCOUNT_STATUS_STYLES.active
                        }`}
                    >
                        {account.status}
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Stat label="Cash" value={account.balance_cash} />
                    <Stat label="Credit" value={account.balance_credit} />
                    <Stat label="Crypto" value={account.balance_crypto} />
                </div>
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                        <Stat label="Total tx" value={stats.total_transactions} />
                        <Stat label="Completed" value={stats.completed_count} />
                        <Stat label="Pending" value={stats.pending_count} />
                        <Stat label="Failed" value={stats.failed_count} />
                        <Stat label="Volume" value={stats.total_volume.toFixed(2)} />
                    </div>
                )}
            </div>

            {error && <div className="p-3 bg-red-100 text-red-700 rounded-md">{error}</div>}

            <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-end gap-2">
                    <FilterSelect
                        label="Status"
                        value={filters.status || ''}
                        options={['', 'pending', 'completed', 'failed', 'reversed']}
                        onChange={(v) => handleFilterChange({ status: (v || undefined) as LedgerTransaction['status'] | undefined })}
                    />
                    <FilterSelect
                        label="Type"
                        value={filters.service_type || ''}
                        options={['', 'deposit', 'withdrawal', 'transfer', 'payment', 'refund', 'fee']}
                        onChange={(v) => handleFilterChange({ service_type: (v || undefined) as LedgerTransaction['service_type'] | undefined })}
                    />
                    <FilterSelect
                        label="Payment"
                        value={filters.payment_type || ''}
                        options={['', 'crypto', 'cash', 'credit', 'debit', 'wire_transfer']}
                        onChange={(v) => handleFilterChange({ payment_type: (v || undefined) as LedgerTransaction['payment_type'] | undefined })}
                    />
                </div>

                {loading && transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Loading transactions…</div>
                ) : transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No transactions found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-left px-4 py-2 font-medium">Created</th>
                                    <th className="text-left px-4 py-2 font-medium">Type</th>
                                    <th className="text-left px-4 py-2 font-medium">Payment</th>
                                    <th className="text-left px-4 py-2 font-medium">Provider</th>
                                    <th className="text-right px-4 py-2 font-medium">Amount</th>
                                    <th className="text-left px-4 py-2 font-medium">Status</th>
                                    <th className="text-left px-4 py-2 font-medium">Ref</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {transactions.map((t) => {
                                    const statusClass = STATUS_STYLES[t.status] || STATUS_STYLES.pending;
                                    return (
                                        <tr key={t.transaction_id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-700">{formatDate(t.created_at)}</td>
                                            <td className="px-4 py-2 text-gray-700">{t.service_type}</td>
                                            <td className="px-4 py-2 text-gray-700">{t.payment_type}</td>
                                            <td className="px-4 py-2 text-gray-700">{t.provider || '—'}</td>
                                            <td className="px-4 py-2 text-right text-gray-900 font-medium">
                                                {formatAmount(t.amount, t.currency)}
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${statusClass}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-gray-500 font-mono text-xs">{t.reference_id || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {pagination && pagination.pages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                        <div>
                            Page {pagination.page} of {pagination.pages} · {pagination.total} transactions
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1 || loading}
                                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page >= pagination.pages || loading}
                                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="border border-gray-200 rounded p-2">
            <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
            <div className="text-sm font-semibold text-gray-900">{value}</div>
        </div>
    );
}

function FilterSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {options.map((o) => (
                    <option key={o} value={o}>
                        {o || 'Any'}
                    </option>
                ))}
            </select>
        </div>
    );
}
