import { getAdminBase, getApiV1Base } from '../lib/backendConfig';

const API_BASE = getAdminBase();
// App-key endpoints are NOT under /admin — they're at /api/v1/app-keys. The
// backend gates the CRUD on role=admin internally, so the admin token still
// works; the URL prefix just differs.
const API_V1_BASE = getApiV1Base();

/**
 * Get auth token from localStorage
 * Admin shares authentication with the main GPT app
 */
function getAuthToken(): string | null {
  // Try multiple storage keys for compatibility
  return localStorage.getItem('token') || localStorage.getItem('voice_token') || null;
}

/**
 * Get authorization headers
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });

  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401) {
    // Redirect to main app login
    window.location.href = '/gpt/frontend/login.html?redirect=' + encodeURIComponent(window.location.href);
    throw new Error('Authentication required');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || data.message || 'Request failed');
  }

  return data;
}

// User Management
export async function listUsers() {
  return request<{ success: boolean; users: any[] }>(`${API_BASE}/users`);
}

export async function getUser(userId: number) {
  return request<{ success: boolean; user: any }>(`${API_BASE}/users/${userId}`);
}

export interface UserAccount {
  id: number;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  plan: string;
  role: string;
  provider: 'email' | 'google' | 'facebook';
  email_verified: boolean;
  has_firebase_uid: boolean;
  last_login: string | null;
  created_at: string | null;
  tokens_in: number;
  tokens_out: number;
  total_tokens: number;
  free_quota: number;
  is_free_prospect: boolean;
  free_quota_percent: number | null;
}

export async function getUserAccount(userId: number) {
  return request<{ success: boolean; account: UserAccount }>(
    `${API_BASE}/users/${userId}/account`
  );
}

export async function getUserCosts(userId: number) {
  return request<{ success: boolean; user_id: number; usageCosts: any }>(
    `${API_BASE}/users/${userId}/costs`
  );
}

export interface ExchangeRatesPayload {
  USD: number;
  EUR: number;
  CAD: number;
}

export async function getExchangeRates() {
  return request<{ success: boolean; rates: ExchangeRatesPayload; lastUpdated: string | null }>(
    `${API_BASE}/exchange-rates`
  );
}

export async function refreshExchangeRatesApi() {
  return request<{ success: boolean; rates: ExchangeRatesPayload; lastUpdated: string | null }>(
    `${API_BASE}/exchange-rates/refresh`,
    { method: 'POST' }
  );
}

export async function createUser(email: string, password: string, firstName?: string, lastName?: string, role?: string) {
  return request<{ success: boolean; user_id: number }>(`${API_BASE}/users`, {
    method: 'POST',
    body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName, role }),
  });
}

export async function updateUser(userId: number, email: string, firstName?: string, lastName?: string, role?: string, password?: string) {
  return request<{ success: boolean }>(`${API_BASE}/users/update`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, email, first_name: firstName, last_name: lastName, role, password }),
  });
}

export async function deleteUser(userId: number) {
  return request<{ success: boolean }>(`${API_BASE}/users/${userId}`, {
    method: 'DELETE',
  });
}

/**
 * Generate (or rotate) a per-user app key for an arbitrary user. The full
 * key is returned exactly once. Requires the caller to be authenticated as
 * a user with role=admin. The action lives on the /auth controller (not
 * /admin), so we bypass the API_BASE prefix here.
 */
export async function generateUserAppKey(userId: number) {
  const res = await fetch(`${API_V1_BASE}/auth`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action: 'admin_generate_app_key', user_id: userId }),
  });
  if (res.status === 401) {
    window.location.href = '/gpt/frontend/login.html?redirect=' + encodeURIComponent(window.location.href);
    throw new Error('Authentication required');
  }
  const data = await res.json();
  if (!data?.success) {
    throw new Error(data?.message || data?.error || 'Failed to generate app key');
  }
  return data as {
    success: boolean;
    message?: string;
    data: { user_id: number; app_key: string; app_key_prefix: string; app_key_created_at: string };
  };
}

/**
 * Revoke an arbitrary user's app key. Requires the caller to be authenticated
 * as a user with role=admin. Idempotent.
 */
export async function revokeUserAppKey(userId: number) {
  const res = await fetch(`${API_V1_BASE}/auth`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action: 'admin_revoke_app_key', user_id: userId }),
  });
  if (res.status === 401) {
    window.location.href = '/gpt/frontend/login.html?redirect=' + encodeURIComponent(window.location.href);
    throw new Error('Authentication required');
  }
  const data = await res.json();
  if (!data?.success) {
    throw new Error(data?.message || data?.error || 'Failed to revoke app key');
  }
  return data as { success: boolean; message?: string; data: { user_id: number } };
}

// Provider Settings
export async function getProviderSettings(userId: number) {
  return request<{ success: boolean; avatar: any; voice: any }>(
    `${API_BASE}/users/${userId}/providers`
  );
}

export async function saveProvider(
  userId: number,
  category: 'avatar' | 'voice',
  provider: string,
  apiKey?: string,
  settings?: Record<string, unknown>
) {
  return request<{ success: boolean }>(`${API_BASE}/providers`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      category,
      provider,
      api_key: apiKey,
      settings,
    }),
  });
}

export async function setActiveProvider(userId: number, category: 'avatar' | 'voice', provider: string) {
  // Use saveProvider with just the provider name to set it as active
  return request<{ success: boolean }>(`${API_BASE}/providers`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, category, provider, set_active: true }),
  });
}

export async function deleteProvider(userId: number, category: 'avatar' | 'voice', provider: string) {
  return request<{ success: boolean }>(`${API_BASE}/providers`, {
    method: 'DELETE',
    body: JSON.stringify({ user_id: userId, category, provider }),
  });
}

export async function toggleCategoryEnabled(userId: number, category: 'avatar' | 'voice', enabled: boolean) {
  return request<{ success: boolean }>(`${API_BASE}/providers/category-toggle`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, category, enabled }),
  });
}

export async function toggleProviderEnabled(userId: number, category: 'avatar' | 'voice', provider: string, enabled: boolean) {
  return request<{ success: boolean }>(`${API_BASE}/providers/toggle`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, category, provider, enabled }),
  });
}

// LLM API Keys
import type { ApiKeySavePayload } from '../types';

export async function getApiKeys(userId: number) {
  return request<{ success: boolean; keys: any }>(`${API_BASE}/users/${userId}/keys`);
}

export async function saveApiKeys(
  userId: number,
  keys: Record<string, ApiKeySavePayload | string>
) {
  return request<{ success: boolean }>(`${API_BASE}/keys`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, keys }),
  });
}

export async function deleteApiKey(userId: number, provider: string) {
  return request<{ success: boolean }>(`${API_BASE}/keys/delete`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, provider }),
  });
}

// System LLM Settings
import type { LLMProviderConfig } from '../types';

export async function getLLMSettings() {
  return request<{ success: boolean; providers: LLMProviderConfig[]; source: string }>(
    `${API_BASE}/llm-settings`
  );
}

export async function getLLMProvider(providerKey: string) {
  return request<{ success: boolean; provider: LLMProviderConfig }>(
    `${API_BASE}/llm-settings/${providerKey}`
  );
}

export async function saveLLMProvider(provider: Partial<LLMProviderConfig>) {
  return request<{ success: boolean; message: string; provider_key: string }>(
    `${API_BASE}/llm-settings`,
    {
      method: 'POST',
      body: JSON.stringify(provider),
    }
  );
}

export async function deleteLLMProvider(providerKey: string) {
  return request<{ success: boolean; message: string }>(
    `${API_BASE}/llm-settings/${providerKey}`,
    {
      method: 'DELETE',
    }
  );
}

export async function toggleLLMProvider(providerKey: string, enabled?: boolean) {
  return request<{ success: boolean; message: string }>(
    `${API_BASE}/llm-settings/toggle`,
    {
      method: 'POST',
      body: JSON.stringify({ provider_key: providerKey, enabled }),
    }
  );
}

export async function seedLLMFromConfig() {
  return request<{ success: boolean; message: string; seeded: string[]; default_provider: string }>(
    `${API_BASE}/llm-settings/seed`,
    {
      method: 'POST',
    }
  );
}

// MCP Servers
export interface McpServer {
  id: number;
  is_global: boolean;
  user_id: string | null;
  user_email: string | null;
  name: string;
  url: string;
  description: string | null;
  headers: Record<string, string> | null;
  enabled: boolean;
  tool_count: number;
  created_at: string;
  updated_at: string;
}

export async function listMcpServers(opts?: { scope?: 'all' | 'global' | 'user'; userId?: number | string }) {
  const params = new URLSearchParams();
  if (opts?.scope) params.set('scope', opts.scope);
  if (opts?.userId !== undefined && opts.userId !== '') params.set('user_id', String(opts.userId));
  const qs = params.toString();
  return request<{ success: boolean; servers: McpServer[] }>(
    `${API_BASE}/mcp/servers${qs ? `?${qs}` : ''}`
  );
}

export async function createMcpServer(data: {
  name: string;
  url: string;
  description?: string;
  user_id?: number | null;
  headers?: Record<string, string> | null;
}) {
  return request<{ success: boolean; server_id: number; tools_fetched: number; tools_error?: string | null; message: string }>(
    `${API_BASE}/mcp/servers`,
    { method: 'POST', body: JSON.stringify(data) }
  );
}

export async function updateMcpServer(data: {
  server_id: number;
  name: string;
  url: string;
  description?: string;
  headers?: Record<string, string> | null;
}) {
  return request<{ success: boolean; tools_fetched: number; tools_error?: string | null; message: string }>(
    `${API_BASE}/mcp/servers/update`,
    { method: 'POST', body: JSON.stringify(data) }
  );
}

export async function toggleMcpServer(serverId: number, enabled: boolean) {
  return request<{ success: boolean; message: string }>(`${API_BASE}/mcp/servers/toggle`, {
    method: 'POST',
    body: JSON.stringify({ server_id: serverId, enabled }),
  });
}

export async function refreshMcpServerTools(serverId: number) {
  return request<{ success: boolean; tools_fetched: number; tools_error?: string | null; message: string }>(
    `${API_BASE}/mcp/servers/refresh`,
    { method: 'POST', body: JSON.stringify({ server_id: serverId }) }
  );
}

export async function deleteMcpServer(serverId: number) {
  return request<{ success: boolean; message: string }>(`${API_BASE}/mcp/servers/${serverId}`, {
    method: 'DELETE',
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-user MCP server overrides
// Cascade: package allowlist → admin per-user override → user chat preference.
// These three endpoints back the per-user MCP panel in gpt_admin.
// ──────────────────────────────────────────────────────────────────────────────

export interface EffectiveMcpServer {
  id: number;
  name: string;
  url: string;
  description: string | null;
  is_global: boolean;
  is_user_private: boolean;
  enabled: boolean;
  tool_count: number;
  /** What the user's role package would allow without any override. */
  package_default: boolean;
  /** Per-user override; null means "no override row, use package_default". */
  override: boolean | null;
  /** Resolved enabled state after applying the cascade. */
  effective: boolean;
}

export async function listUserMcpServers(userId: number) {
  return request<{
    success: boolean;
    user_id: number;
    /** null = no allowlist restriction (package allows everything). */
    package_allowlist: string[] | null;
    servers: EffectiveMcpServer[];
  }>(`${API_BASE}/users/${userId}/mcp-servers`);
}

export async function setUserMcpOverride(userId: number, serverId: number, allowed: boolean) {
  return request<{ success: boolean; user_id: number; server_id: number; allowed: boolean }>(
    `${API_BASE}/users/${userId}/mcp-servers/${serverId}/override`,
    { method: 'PUT', body: JSON.stringify({ allowed }) }
  );
}

export async function clearUserMcpOverride(userId: number, serverId: number) {
  return request<{ success: boolean; user_id: number; server_id: number; cleared: boolean }>(
    `${API_BASE}/users/${userId}/mcp-servers/${serverId}/override`,
    { method: 'DELETE' }
  );
}

// Packages (role-based capability bundles)
import type { Package, PackageCapabilities, Role } from '../types';

export async function listPackages() {
  return request<{ success: boolean; packages: Package[] }>(`${API_BASE}/packages`);
}

export async function getPackage(role: string) {
  return request<{ success: boolean; package: Package }>(`${API_BASE}/packages/${role}`);
}

export async function updatePackage(role: string, capabilities: PackageCapabilities) {
  return request<{ success: boolean; package: Package }>(`${API_BASE}/packages/${role}`, {
    method: 'PUT',
    body: JSON.stringify({ capabilities }),
  });
}

// Roles (custom roles; capabilities are still edited through /packages/{role}).
// Errors come back as { error, kind } (invalid_key, invalid_name, exists,
// not_found, builtin, in_use); the error text is shown as is (in_use names the users).
export async function listRoles() {
  return (await request<{ success: boolean; data: Role[] }>(`${API_BASE}/roles`)).data;
}

export async function createRole(role: string, name: string, copyFrom?: string | null) {
  return (await request<{ success: boolean; data: Role }>(`${API_BASE}/roles`, {
    method: 'POST',
    body: JSON.stringify({ role, name, copy_from: copyFrom ?? null }),
  })).data;
}

export async function renameRole(role: string, name: string) {
  return (await request<{ success: boolean; data: Role }>(`${API_BASE}/roles/${encodeURIComponent(role)}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })).data;
}

export async function deleteRole(role: string) {
  await request<{ success: boolean }>(`${API_BASE}/roles/${encodeURIComponent(role)}`, { method: 'DELETE' });
}

// Legacy scoped App Keys CRUD removed during the merge to a single per-user
// key. Use generateUserAppKey / revokeUserAppKey (above) instead. The backend
// app_keys table and its /app-keys endpoints remain dormant for back-compat
// and can be removed when no callers depend on them.

// Auth helper - check if user is authenticated
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

// Get current user info from token
export function getCurrentUser(): { id: number; email: string; role: string } | null {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.user_id || payload.sub,
      email: payload.email || '',
      role: payload.role || 'user',
    };
  } catch {
    return null;
  }
}

// ─── Video Editor app (per-generation usage + costs) ────────────────────────
export async function getVideoEditorStats(days = 30) {
  return request<any>(`${API_BASE}/video-editor/usage/stats?days=${days}`);
}
export async function getVideoEditorUsageSummary() {
  return request<any>(`${API_BASE}/video-editor/usage/summary`);
}
export async function getVideoEditorByUser(days = 30) {
  return request<any>(`${API_BASE}/video-editor/usage/by-user?days=${days}`);
}
export async function getVideoEditorTransactions(opts: { user_id?: number; month?: string; days?: number; all?: boolean; page?: number; per_page?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.user_id) qs.set('user_id', String(opts.user_id));
  if (opts.month) qs.set('month', opts.month);
  if (opts.days) qs.set('days', String(opts.days));
  if (opts.all) qs.set('all', '1');
  if (opts.page) qs.set('page', String(opts.page));
  if (opts.per_page) qs.set('per_page', String(opts.per_page));
  return request<any>(`${API_BASE}/video-editor/transactions?${qs.toString()}`);
}
export async function getVideoEditorPrices() {
  return request<any>(`${API_BASE}/video-editor/prices`);
}
export async function saveVideoEditorPrice(price: { model: string; unit: string; rate: number; label?: string }) {
  return request<any>(`${API_BASE}/video-editor/prices`, { method: 'POST', body: JSON.stringify(price) });
}
export async function getVideoEditorProviders() {
  return request<any>(`${API_BASE}/video-editor/providers`);
}
export interface VeProviderModel { model: string; label?: string; kind: string; cost: number; unit: string; client_id?: string; start_frame?: boolean; end_frame?: boolean }
export async function saveVideoEditorProvider(p: { provider: string; label?: string; api_base?: string; enabled?: boolean; api_key?: string; clear_key?: boolean; models?: VeProviderModel[] }) {
  return request<any>(`${API_BASE}/video-editor/providers`, { method: 'POST', body: JSON.stringify(p) });
}
export async function getVideoEditorModels() {
  return request<any>(`${API_BASE}/video-editor/models`);
}
export async function saveVideoEditorModel(m: { model: string; provider: string; kind: string; label?: string; enabled?: boolean }) {
  return request<any>(`${API_BASE}/video-editor/models`, { method: 'POST', body: JSON.stringify(m) });
}
export async function getVideoEditorUsers(q = '') {
  return request<any>(`${API_BASE}/video-editor/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
}
export async function setVideoEditorUserRole(user_id: number, role: string) {
  return request<any>(`${API_BASE}/video-editor/users/role`, { method: 'POST', body: JSON.stringify({ user_id, role }) });
}
export async function getVideoEditorPackages() {
  return request<any>(`${API_BASE}/video-editor/packages`);
}
export async function saveVideoEditorPackage(role: string, capabilities: any) {
  return request<any>(`${API_BASE}/video-editor/packages`, { method: 'POST', body: JSON.stringify({ role, capabilities }) });
}
// ---- Login microservice admin ----
export async function getLoginStats() {
  return request<any>(`${API_BASE}/login/stats`);
}
export async function getLoginUsers(params: { q?: string; role?: string; provider?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.role) qs.set('role', params.role);
  if (params.provider) qs.set('provider', params.provider);
  const s = qs.toString();
  return request<any>(`${API_BASE}/login/users${s ? `?${s}` : ''}`);
}
export async function createLoginUser(u: { email: string; first_name?: string; last_name?: string; role?: string }) {
  return request<any>(`${API_BASE}/login/users`, { method: 'POST', body: JSON.stringify(u) });
}
export async function updateLoginUser(u: Record<string, unknown> & { id: number }) {
  return request<any>(`${API_BASE}/login/users/update`, { method: 'POST', body: JSON.stringify(u) });
}
export async function deleteLoginUser(id: number) {
  return request<any>(`${API_BASE}/login/users/delete`, { method: 'POST', body: JSON.stringify({ id }) });
}
export async function getLoginApps() {
  return request<any>(`${API_BASE}/login/apps`);
}
export async function getLoginAppUsers(app: string, q = '') {
  const qs = new URLSearchParams({ app }); if (q) qs.set('q', q);
  return request<any>(`${API_BASE}/login/app-users?${qs.toString()}`);
}
export async function setLoginAppUserRole(app: string, user_id: number, role: string) {
  return request<any>(`${API_BASE}/login/app-users/role`, { method: 'POST', body: JSON.stringify({ app, user_id, role }) });
}
export async function addLoginAppMember(app: string, u: { email: string; first_name?: string; last_name?: string; role: string }) {
  return request<any>(`${API_BASE}/login/app-users/add`, { method: 'POST', body: JSON.stringify({ app, ...u }) });
}

export async function getVideoEditorUserOverride(user_id: number) {
  return request<any>(`${API_BASE}/video-editor/user-override?user_id=${user_id}`);
}
export async function saveVideoEditorUserOverride(user_id: number, capabilities: any, byo_keys: Record<string, string>) {
  return request<any>(`${API_BASE}/video-editor/user-override`, { method: 'POST', body: JSON.stringify({ user_id, capabilities, byo_keys }) });
}
