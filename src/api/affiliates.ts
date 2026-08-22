import { getAdminBase } from '../lib/backendConfig';

const API_BASE = getAdminBase();

function getAuthToken(): string | null {
  return localStorage.getItem('token') || localStorage.getItem('voice_token') || null;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getAuthToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options?.headers } });
  if (res.status === 401) {
    window.location.href = '/gpt/frontend/login.html?redirect=' + encodeURIComponent(window.location.href);
    throw new Error('Authentication required');
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || data.message || 'Request failed');
  return data as T;
}

// ---- Types ----
export interface AffiliateListRow {
  id: number;
  user_id: number;
  name: string;
  email: string;
  affiliate_key: string;
  status: 'active' | 'inactive';
  created_at: string;
  total_earned: string;
  owed: string;
  product_count: number;
}

export interface AffiliateAccount {
  account_id: number;
  affiliate_id: number;
  product_id: number;
  product_name: string;
  sales_page_url: string;
  currency: string;
  effective_type: 'percent' | 'fixed';
  effective_value: number;
  earnings: string;
  owed: string;
  link: string | null;
}

export interface AffiliateDetail {
  id: number;
  name: string;
  email: string;
  affiliate_key: string;
  status: string;
}

export interface AffiliateTransaction {
  id: number;
  product_id: number;
  product_name: string;
  sale_amount: string;
  currency: string;
  commission_amount: string;
  status: 'pending' | 'paid';
  external_ref: string | null;
  occurred_at: string;
  paid_at: string | null;
}

export interface TransactionTotals { paid: number; owed: number; total: number; }

export interface AffiliateProduct {
  id: number;
  name: string;
  app_ref: string | null;
  sales_page_url: string;
  commission_type: 'percent' | 'fixed';
  commission_value: string;
  currency: string;
  active: number;
}

// ---- Affiliates ----
export const listAffiliates = () =>
  request<{ success: boolean; affiliates: AffiliateListRow[] }>(`${API_BASE}/affiliates`);

export const getAffiliate = (id: number) =>
  request<{ success: boolean; affiliate: AffiliateDetail; accounts: AffiliateAccount[] }>(`${API_BASE}/affiliates/${id}`);

export const createAffiliate = (name: string, email: string, password: string) =>
  request<{ success: boolean; affiliate_id: number; affiliate_key: string; existing_user: boolean }>(`${API_BASE}/affiliates`, {
    method: 'POST', body: JSON.stringify({ name, email, password }),
  });

export const deleteAffiliate = (id: number) =>
  request<{ success: boolean }>(`${API_BASE}/affiliates/${id}`, { method: 'DELETE' });

export const getAffiliateTransactions = (id: number) =>
  request<{ success: boolean; transactions: AffiliateTransaction[]; totals: TransactionTotals }>(
    `${API_BASE}/affiliates/${id}/transactions`);

export const markTransactionPaid = (id: number, saleId: number) =>
  request<{ success: boolean; updated: number }>(
    `${API_BASE}/affiliates/${id}/transactions/${saleId}/mark-paid`, { method: 'POST' });

export const addAffiliateAccount = (
  id: number, productId: number, override?: { commission_type: 'percent' | 'fixed'; commission_value: number }
) =>
  request<{ success: boolean }>(`${API_BASE}/affiliates/${id}/accounts`, {
    method: 'POST', body: JSON.stringify({ product_id: productId, ...override }),
  });

export const updateAffiliateAccount = (
  id: number, productId: number,
  override: { commission_type: 'percent' | 'fixed' | ''; commission_value: number | '' }
) =>
  request<{ success: boolean }>(`${API_BASE}/affiliates/${id}/accounts/${productId}`, {
    method: 'PUT', body: JSON.stringify(override),
  });

export const deleteAffiliateAccount = (id: number, productId: number) =>
  request<{ success: boolean }>(`${API_BASE}/affiliates/${id}/accounts/${productId}`, { method: 'DELETE' });

// ---- Products ----
export const listAffiliateProducts = () =>
  request<{ success: boolean; products: AffiliateProduct[] }>(`${API_BASE}/affiliate-products`);

export interface ProductInput {
  name: string; app_ref?: string | null; sales_page_url: string;
  commission_type: 'percent' | 'fixed'; commission_value: number; currency: string; active: number;
}

export const createAffiliateProduct = (p: ProductInput) =>
  request<{ success: boolean; product_id: number }>(`${API_BASE}/affiliate-products`, {
    method: 'POST', body: JSON.stringify(p),
  });

export const updateAffiliateProduct = (id: number, p: ProductInput) =>
  request<{ success: boolean }>(`${API_BASE}/affiliate-products/${id}`, {
    method: 'PUT', body: JSON.stringify(p),
  });

export const deleteAffiliateProduct = (id: number) =>
  request<{ success: boolean }>(`${API_BASE}/affiliate-products/${id}`, { method: 'DELETE' });
