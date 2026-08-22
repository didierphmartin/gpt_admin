const LEDGER_API_BASE = '/LandingPage/Ledger/api/v1';
const LEDGER_API_KEY = (import.meta.env.VITE_LEDGER_API_KEY as string | undefined) || '';

if (!LEDGER_API_KEY) {
    console.warn(
        '[ledger] VITE_LEDGER_API_KEY is empty. Copy .env.example to .env.local and set it. ' +
            'Ledger requests will fail with 401 until configured.'
    );
}

function headers(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'X-API-Key': LEDGER_API_KEY,
    };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { ...init, headers: { ...headers(), ...(init?.headers || {}) } });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
        // Ledger error envelope: { success:false, error:{ code, message, timestamp } }
        const errObj = json?.error;
        const msg =
            (errObj && typeof errObj === 'object' && (errObj.message || errObj.code)) ||
            (typeof errObj === 'string' ? errObj : null) ||
            json?.message ||
            `Ledger request failed (${res.status})`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return (json.data ?? json) as T;
}

export interface LedgerAccount {
    user_id: string;
    email: string;
    application: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    balance_crypto: string;
    balance_cash: string;
    balance_credit: string;
    status: 'active' | 'suspended' | 'closed';
    created_at: string;
    updated_at: string;
}

export interface LedgerTransaction {
    transaction_id: string;
    user_id: string;
    amount: number;
    currency: string;
    payment_type: 'crypto' | 'cash' | 'credit' | 'debit' | 'wire_transfer';
    provider: string | null;
    service_type: 'deposit' | 'withdrawal' | 'transfer' | 'payment' | 'refund' | 'fee';
    status: 'pending' | 'completed' | 'failed' | 'reversed';
    reference_id: string | null;
    created_at: string;
    completed_at: string | null;
}

export interface LedgerPagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface ListLedgerTransactionsResult {
    transactions: LedgerTransaction[];
    pagination: LedgerPagination;
}

export interface ListLedgerTransactionsParams {
    page?: number;
    limit?: number;
    status?: LedgerTransaction['status'];
    payment_type?: LedgerTransaction['payment_type'];
    service_type?: LedgerTransaction['service_type'];
    currency?: string;
    date_from?: string;
    date_to?: string;
}

export interface LedgerStatistics {
    total_transactions: number;
    completed_count: number;
    failed_count: number;
    pending_count: number;
    total_volume: number;
}

export interface ListAccountsParams {
    page?: number;
    limit?: number;
    search?: string;
    application?: 'PortfolioManagement' | 'SynergyAiChat';
    status?: LedgerAccount['status'];
}

export interface ListAccountsResult {
    accounts: LedgerAccount[];
    pagination: LedgerPagination;
}

export async function listAccounts(params: ListAccountsParams = {}): Promise<ListAccountsResult> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    if (params.application) qs.set('application', params.application);
    if (params.status) qs.set('status', params.status);
    const url = `${LEDGER_API_BASE}/accounts${qs.toString() ? `?${qs}` : ''}`;
    return request<ListAccountsResult>(url);
}

export async function getAccountByEmail(email: string, application?: string): Promise<LedgerAccount> {
    const qs = application ? `?application=${encodeURIComponent(application)}` : '';
    return request<LedgerAccount>(`${LEDGER_API_BASE}/account/by-email/${encodeURIComponent(email)}${qs}`);
}

export async function getAccountByUserId(userId: string): Promise<LedgerAccount> {
    return request<LedgerAccount>(`${LEDGER_API_BASE}/account/${encodeURIComponent(userId)}`);
}

export async function listTransactions(
    userId: string,
    params: ListLedgerTransactionsParams = {}
): Promise<ListLedgerTransactionsResult> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.status) qs.set('status', params.status);
    if (params.payment_type) qs.set('payment_type', params.payment_type);
    if (params.service_type) qs.set('service_type', params.service_type);
    if (params.currency) qs.set('currency', params.currency);
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to) qs.set('date_to', params.date_to);
    const url = `${LEDGER_API_BASE}/transactions/user/${encodeURIComponent(userId)}${qs.toString() ? `?${qs}` : ''}`;
    return request<ListLedgerTransactionsResult>(url);
}

export async function getTransactionStatistics(userId: string): Promise<LedgerStatistics> {
    return request<LedgerStatistics>(`${LEDGER_API_BASE}/transactions/user/${encodeURIComponent(userId)}/statistics`);
}

export interface LedgerTransactionWithAccount extends LedgerTransaction {
    account_email: string | null;
    account_application: string | null;
}

export interface ListAllTransactionsParams extends ListLedgerTransactionsParams {
    search?: string;
    application?: 'PortfolioManagement' | 'SynergyAiChat';
}

export interface ListAllTransactionsResult {
    transactions: LedgerTransactionWithAccount[];
    pagination: LedgerPagination;
}

export async function listAllTransactions(
    params: ListAllTransactionsParams = {}
): Promise<ListAllTransactionsResult> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.status) qs.set('status', params.status);
    if (params.payment_type) qs.set('payment_type', params.payment_type);
    if (params.service_type) qs.set('service_type', params.service_type);
    if (params.currency) qs.set('currency', params.currency);
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to) qs.set('date_to', params.date_to);
    if (params.search) qs.set('search', params.search);
    if (params.application) qs.set('application', params.application);
    const url = `${LEDGER_API_BASE}/transactions${qs.toString() ? `?${qs}` : ''}`;
    return request<ListAllTransactionsResult>(url);
}
