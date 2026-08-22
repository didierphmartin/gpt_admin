import { getApiV1Base } from '../lib/backendConfig';

const API = getApiV1Base();

export function getToken(): string | null {
  return localStorage.getItem('token') || localStorage.getItem('voice_token');
}
export function setToken(t: string) { localStorage.setItem('token', t); }
export function clearToken() { localStorage.removeItem('token'); localStorage.removeItem('voice_token'); }

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.success || !data.data?.access_token) throw new Error(data.error || data.message || 'Login failed');
  return data.data.access_token as string;
}

export interface MeAccount {
  product_id: number;
  product_name: string; sales_page_url: string; currency: string;
  effective_type: 'percent' | 'fixed'; effective_value: number;
  earnings: string; owed: string; link: string | null;
}
export interface MeResponse {
  affiliate: { id: number; name: string; email: string; affiliate_key: string; status: string };
  accounts: MeAccount[];
}
export interface PortalTransaction {
  id: number; product_name: string; sale_amount: string; currency: string;
  commission_amount: string; status: 'pending' | 'paid'; occurred_at: string; paid_at: string | null;
}
export interface PortalTotals { paid: number; owed: number; total: number; }

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || data.message || 'Request failed');
  return data as T;
}

export const fetchMe = () => get<{ success: boolean } & MeResponse>('/affiliate/me');
export const fetchMyTransactions = () =>
  get<{ success: boolean; transactions: PortalTransaction[]; totals: PortalTotals }>('/affiliate/me/transactions');
